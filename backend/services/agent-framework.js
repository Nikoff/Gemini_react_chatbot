const { prisma, ai, logger } = require('../middleware/shared');
const { spendCredits, CREDIT_COSTS } = require('./credits');

class BaseAgent {
  constructor(config = {}) {
    this.name = config.name || 'Agent';
    this.type = config.type || 'custom';
    this.model = config.model || 'gemini-2.5-flash';
    this.systemPrompt = config.systemPrompt || '';
    this.description = config.description || '';
  }

  async run(input, context = {}) {
    throw new Error('Agent must implement run()');
  }

  async callLLM(messages, options = {}) {
    const payload = {
      model: options.model || this.model,
      contents: messages,
    };

    if (this.systemPrompt || options.systemInstruction) {
      payload.config = {
        systemInstruction: [{ text: options.systemInstruction || this.systemPrompt }],
      };
    }

    const response = await ai.models.generateContent(payload);
    return response.text;
  }

  async callLLMStream(messages, options = {}, onChunk) {
    const payload = {
      model: options.model || this.model,
      contents: messages,
    };

    if (this.systemPrompt || options.systemInstruction) {
      payload.config = {
        systemInstruction: [{ text: options.systemInstruction || this.systemPrompt }],
      };
    }

    const stream = await ai.models.generateContentStream(payload);
    let fullText = '';

    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      if (chunkText) {
        fullText += chunkText;
        onChunk?.(chunkText, fullText);
      }
    }

    return fullText;
  }

  log(runId, level, message) {
    logger[level](`[${this.name}] ${message}`);
  }
}

class PlannerAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      type: 'planner',
      name: config.name || 'Planner',
      systemPrompt: config.systemPrompt || `You are a task planning agent. Your job is to:
1. Analyze the user's request
2. Break it down into clear, actionable subtasks
3. Define the order and dependencies between tasks
4. Assign each subtask to the appropriate agent type

Respond with a JSON array of tasks:
[
  {
    "id": "task_1",
    "title": "Task title",
    "description": "Detailed description",
    "agentType": "generator|editor|qa|publisher",
    "dependsOn": [],
    "input": { "key": "value" }
  }
]

Only respond with valid JSON. No other text.`,
    });
  }

  async run(input) {
    const prompt = typeof input === 'string' ? input : JSON.stringify(input);
    const messages = [{ role: 'user', parts: [{ text: prompt }] }];

    const response = await this.callLLM(messages);

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return { tasks: JSON.parse(jsonMatch[0]), raw: response };
      }
      return { tasks: [], raw: response };
    } catch {
      return { tasks: [], raw: response };
    }
  }
}

class GeneratorAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      type: 'generator',
      name: config.name || 'Generator',
      systemPrompt: config.systemPrompt || 'You are a content generation agent. Generate high-quality content based on the given task.',
    });
  }

  async run(input, context = {}) {
    const task = typeof input === 'string' ? input : input.description || JSON.stringify(input);
    const messages = [{ role: 'user', parts: [{ text: task }] }];

    const response = await this.callLLM(messages);
    return { content: response };
  }
}

class EditorAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      type: 'editor',
      name: config.name || 'Editor',
      systemPrompt: config.systemPrompt || `You are an editing agent. Your job is to:
1. Review the provided content
2. Improve quality, clarity, and coherence
3. Fix errors and inconsistencies
4. Return the improved version

Respond with the edited content only.`,
    });
  }

  async run(input, context = {}) {
    const content = typeof input === 'string' ? input : input.content || JSON.stringify(input);
    const messages = [{ role: 'user', parts: [{ text: `Please review and improve this content:\n\n${content}` }] }];

    const response = await this.callLLM(messages);
    return { content: response };
  }
}

class QAAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      type: 'qa',
      name: config.name || 'QA',
      systemPrompt: config.systemPrompt || `You are a quality assurance agent. Your job is to:
1. Review the provided content critically
2. Check for errors, inconsistencies, and quality issues
3. Provide a structured quality report

Respond in JSON format:
{
  "score": 0-100,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "approved": true|false,
  "summary": "Brief summary"
}`,
    });
  }

  async run(input, context = {}) {
    const content = typeof input === 'string' ? input : input.content || JSON.stringify(input);
    const messages = [{ role: 'user', parts: [{ text: `Please review this content for quality:\n\n${content}` }] }];

    const response = await this.callLLM(messages);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { score: 50, issues: [], suggestions: [], approved: true, summary: response };
    } catch {
      return { score: 50, issues: [], suggestions: [], approved: true, summary: response };
    }
  }
}

class PublisherAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      type: 'publisher',
      name: config.name || 'Publisher',
      systemPrompt: config.systemPrompt || 'You are a publishing agent. Prepare content for final output.',
    });
  }

  async run(input, context = {}) {
    const content = typeof input === 'string' ? input : input.content || JSON.stringify(input);
    return { published: true, content, publishedAt: new Date().toISOString() };
  }
}

const AGENT_TYPES = {
  planner: PlannerAgent,
  generator: GeneratorAgent,
  editor: EditorAgent,
  qa: QAAgent,
  publisher: PublisherAgent,
};

function createAgent(type, config = {}) {
  const AgentClass = AGENT_TYPES[type] || BaseAgent;
  return new AgentClass({ ...config, type });
}

module.exports = {
  BaseAgent,
  PlannerAgent,
  GeneratorAgent,
  EditorAgent,
  QAAgent,
  PublisherAgent,
  AGENT_TYPES,
  createAgent,
};
