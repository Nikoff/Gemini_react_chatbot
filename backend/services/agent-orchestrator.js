const { prisma, logger } = require('../middleware/shared');
const { createAgent } = require('./agent-framework');
const { spendCredits, CREDIT_COSTS } = require('./credits');

async function createAgentRun(agentId, userId, input) {
  return prisma.agentRun.create({
    data: {
      agentId,
      userId,
      status: 'pending',
      input,
      logs: [],
      startedAt: new Date(),
    },
  });
}

async function addLog(runId, level, message) {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  const logs = run.logs || [];
  logs.push({ timestamp: new Date().toISOString(), level, message });

  await prisma.agentRun.update({
    where: { id: runId },
    data: { logs },
  });

  logger[level](`[AgentRun:${runId}] ${message}`);
}

async function runAgentPipeline(agentId, userId, input) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error('Agent not found');
  if (agent.userId !== userId) throw new Error('Access denied');

  const run = await createAgentRun(agentId, userId, input);

  try {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: 'running' },
    });
    await addLog(run.id, 'info', `Agent ${agent.name} started`);

    const agentInstance = createAgent(agent.type, {
      name: agent.name,
      model: agent.config?.model || 'gemini-2.5-flash',
      systemPrompt: agent.config?.systemPrompt || '',
    });

    const cost = CREDIT_COSTS.chat_gemini;
    const deduction = await spendCredits(userId, cost, 'agent_run');
    if (!deduction.success) {
      throw new Error('Insufficient credits');
    }

    const result = await agentInstance.run(input);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        output: result,
        creditsUsed: cost,
        completedAt: new Date(),
      },
    });
    await addLog(run.id, 'info', `Agent ${agent.name} completed`);

    return { runId: run.id, status: 'completed', output: result, creditsUsed: cost };

  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: err.message,
        completedAt: new Date(),
      },
    });
    await addLog(run.id, 'error', `Agent failed: ${err.message}`);
    throw err;
  }
}

async function orchestrateTask(taskDescription, userId) {
  logger.info(`[Orchestrate] Starting orchestration for: ${taskDescription.substring(0, 100)}`);

  const plannerAgent = createAgent('planner', {
    name: 'Task Planner',
    model: 'gemini-2.5-flash',
  });

  const plan = await plannerAgent.run(taskDescription);
  const tasks = plan.tasks || [];

  if (tasks.length === 0) {
    return {
      status: 'completed',
      plan: [],
      results: [],
      message: 'No tasks generated from plan',
    };
  }

  logger.info(`[Orchestrate] Plan generated: ${tasks.length} tasks`);

  const results = [];
  const completedTasks = new Set();

  let iterations = 0;
  while (completedTasks.size < tasks.length && iterations < 20) {
    iterations++;
    const readyTasks = tasks.filter(t =>
      !completedTasks.has(t.id) &&
      (t.dependsOn || []).every(dep => completedTasks.has(dep))
    );

    if (readyTasks.length === 0) break;

    const taskPromises = readyTasks.map(async (task) => {
      try {
        const agentType = task.agentType || 'generator';
        const agent = createAgent(agentType, { name: task.title });

        const deduction = await spendCredits(userId, CREDIT_COSTS.chat_gemini, 'agent_task');
        if (!deduction.success) {
          return { taskId: task.id, status: 'failed', error: 'Insufficient credits' };
        }

        const taskInput = {
          ...task.input,
          description: task.description,
          previousResults: results.filter(r => completedTasks.has(r.taskId)),
        };

        const result = await agent.run(taskInput);
        completedTasks.add(task.id);

        logger.info(`[Orchestrate] Task "${task.title}" completed`);
        return { taskId: task.id, status: 'completed', output: result };

      } catch (err) {
        completedTasks.add(task.id);
        logger.error(`[Orchestrate] Task "${task.title}" failed: ${err.message}`);
        return { taskId: task.id, status: 'failed', error: err.message };
      }
    });

    const batchResults = await Promise.all(taskPromises);
    results.push(...batchResults);
  }

  return {
    status: 'completed',
    plan: tasks,
    results,
    summary: results.map(r => `Task ${r.taskId}: ${r.status}`).join('\n'),
  };
}

async function getAgentRuns(agentId, userId, limit = 20) {
  return prisma.agentRun.findMany({
    where: { agentId, userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { agent: { select: { name: true, type: true } } },
  });
}

async function getActiveRuns(userId) {
  return prisma.agentRun.findMany({
    where: { userId, status: { in: ['pending', 'running'] } },
    orderBy: { startedAt: 'desc' },
    include: { agent: { select: { name: true, type: true } } },
  });
}

module.exports = {
  createAgentRun,
  addLog,
  runAgentPipeline,
  orchestrateTask,
  getAgentRuns,
  getActiveRuns,
};
