const { prisma, ai, logger } = require('../middleware/shared');
const { ComfyUIClient, buildTextToImageWorkflow } = require('./comfyui');
const { spendCredits, CREDIT_COSTS } = require('./credits');

const comfyui = new ComfyUIClient(process.env.COMFYUI_URL || 'http://127.0.0.1:8188');

const NODE_HANDLERS = {
  input: async (node, context) => {
    return { output: context.input || node.config?.defaultValue || '' };
  },

  text_gen: async (node, context) => {
    const prompt = interpolate(node.config?.prompt || '', context);
    const systemInstruction = node.config?.systemInstruction
      ? [{ text: interpolate(node.config.systemInstruction, context) }]
      : undefined;

    const payload = {
      model: node.config?.model || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };
    if (systemInstruction) {
      payload.config = { systemInstruction };
    }

    const response = await ai.models.generateContent(payload);
    return { output: response.text };
  },

  image_gen: async (node, context) => {
    const prompt = interpolate(node.config?.prompt || '', context);
    const available = await ensureComfyUI();
    if (!available) throw new Error('ComfyUI not available');

    const workflow = buildTextToImageWorkflow(prompt, {
      negativePrompt: node.config?.negativePrompt,
      width: node.config?.width || 512,
      height: node.config?.height || 512,
      steps: node.config?.steps || 20,
    });

    const { prompt_id } = await comfyui.queuePrompt(workflow);
    await comfyui.waitForCompletion(prompt_id);

    const history = await comfyui.getHistory(prompt_id);
    const promptHistory = history[prompt_id];
    let imageData = null;

    if (promptHistory?.outputs) {
      for (const nodeId of Object.keys(promptHistory.outputs)) {
        const output = promptHistory.outputs[nodeId];
        if (output.images?.length > 0) {
          const buf = await comfyui.getImage(output.images[0].filename);
          imageData = { data: buf.toString('base64'), mimeType: 'image/png', filename: output.images[0].filename };
          break;
        }
      }
    }

    return { output: imageData };
  },

  transform: async (node, context) => {
    const template = node.config?.template || '';
    const result = interpolate(template, context);
    return { output: result };
  },

  output: async (node, context) => {
    return { output: context };
  },
};

function interpolate(template, context) {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value = context;
    for (const key of keys) {
      value = value?.[key];
    }
    return value !== undefined && value !== null ? String(value) : match;
  });
}

async function ensureComfyUI() {
  try {
    await comfyui.connect();
    return true;
  } catch {
    return false;
  }
}

function buildExecutionOrder(graph) {
  const { nodes = [], edges = [] } = graph;
  const inDegree = {};
  const adjacency = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
  }

  for (const edge of edges) {
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    adjacency[edge.source] = adjacency[edge.source] || [];
    adjacency[edge.source].push(edge.target);
  }

  const queue = [];
  for (const node of nodes) {
    if (inDegree[node.id] === 0) queue.push(node.id);
  }

  const levels = [];
  while (queue.length > 0) {
    const level = [...queue];
    levels.push(level);
    queue.length = 0;
    for (const nodeId of level) {
      for (const target of (adjacency[nodeId] || [])) {
        inDegree[target]--;
        if (inDegree[target] === 0) queue.push(target);
      }
    }
  }

  return levels;
}

function getNodeById(graph, nodeId) {
  return graph.nodes.find(n => n.id === nodeId);
}

function collectNodeInputs(nodeId, graph, nodeOutputs) {
  const inputs = {};
  const { edges = [] } = graph;

  for (const edge of edges) {
    if (edge.target === nodeId) {
      const sourceOutput = nodeOutputs[edge.source];
      const targetHandle = edge.targetHandle || 'input';
      inputs[targetHandle] = sourceOutput;
    }
  }

  return inputs;
}

async function executeWorkflow(workflowId, userId, input = {}) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error('Workflow not found');
  if (workflow.userId !== userId) throw new Error('Access denied');

  const graph = workflow.graph;
  const levels = buildExecutionOrder(graph);
  const nodeOutputs = {};
  const nodeStates = {};
  let creditsUsed = 0;

  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      userId,
      status: 'running',
      input,
      nodeStates: {},
      startedAt: new Date(),
    },
  });

  try {
    for (const level of levels) {
      const promises = level.map(async (nodeId) => {
        const node = getNodeById(graph, nodeId);
        if (!node) return;

        nodeStates[nodeId] = { status: 'running' };

        const nodeInputs = collectNodeInputs(nodeId, graph, nodeOutputs);
        const context = { ...input, ...nodeInputs };

        const handler = NODE_HANDLERS[node.type];
        if (!handler) {
          throw new Error(`Unknown node type: ${node.type}`);
        }

        const cost = CREDIT_COSTS[node.type] || 0;
        if (cost > 0) {
          const deduction = await spendCredits(userId, cost, 'workflow');
          if (!deduction.success) {
            throw new Error(`Insufficient credits for node ${nodeId}`);
          }
          creditsUsed += cost;
        }

        const result = await handler(node, context);
        nodeOutputs[nodeId] = result.output;
        nodeStates[nodeId] = { status: 'completed', output: result.output };

        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { nodeStates, creditsUsed },
        });
      });

      await Promise.all(promises);
    }

    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'completed',
        output: nodeOutputs,
        nodeStates,
        creditsUsed,
        completedAt: new Date(),
      },
    });

    return { executionId: execution.id, status: 'completed', output: nodeOutputs, creditsUsed };

  } catch (err) {
    logger.error(`Workflow execution failed: ${err.message}`);

    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'failed',
        error: err.message,
        nodeStates,
        creditsUsed,
        completedAt: new Date(),
      },
    });

    throw err;
  }
}

module.exports = { executeWorkflow, buildExecutionOrder, NODE_HANDLERS, interpolate };
