const { prisma, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');
const { runAgentPipeline, orchestrateTask, getAgentRuns, getActiveRuns } = require('../services/agent-orchestrator');

module.exports = function(app) {
  app.get('/api/agents', requireAuth, async (req, res) => {
    const userId = req.user.sub;

    try {
      const agents = await prisma.agent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(agents);
    } catch (err) {
      logger.error(`GET /api/agents failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch agents.' });
    }
  });

  app.get('/api/agents/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
      const agent = await prisma.agent.findUnique({ where: { id } });
      if (!agent) return res.status(404).json({ error: 'Agent not found.' });
      if (agent.userId !== req.user.sub) return res.status(403).json({ error: 'Access denied.' });
      res.json(agent);
    } catch (err) {
      logger.error(`GET /api/agents/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch agent.' });
    }
  });

  app.post('/api/agents', requireAuth, async (req, res) => {
    const { name, type, description, config } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const validTypes = ['planner', 'generator', 'editor', 'qa', 'publisher', 'custom'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    try {
      const agent = await prisma.agent.create({
        data: {
          userId: req.user.sub,
          name: name.trim(),
          type: type || 'custom',
          description: description || null,
          config: config || {},
        },
      });

      logger.info(`Agent created: ${agent.id} by user ${req.user.sub}`);
      res.json(agent);
    } catch (err) {
      logger.error(`POST /api/agents failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to create agent.' });
    }
  });

  app.put('/api/agents/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, type, description, config } = req.body;

    try {
      const agent = await prisma.agent.findUnique({ where: { id } });
      if (!agent) return res.status(404).json({ error: 'Agent not found.' });
      if (agent.userId !== req.user.sub) return res.status(403).json({ error: 'Access denied.' });

      const updated = await prisma.agent.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(description !== undefined && { description }),
          ...(config !== undefined && { config }),
        },
      });

      res.json(updated);
    } catch (err) {
      logger.error(`PUT /api/agents/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to update agent.' });
    }
  });

  app.delete('/api/agents/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
      const agent = await prisma.agent.findUnique({ where: { id } });
      if (!agent) return res.status(404).json({ error: 'Agent not found.' });
      if (agent.userId !== req.user.sub) return res.status(403).json({ error: 'Access denied.' });

      await prisma.agent.delete({ where: { id } });
      logger.info(`Agent deleted: ${id}`);
      res.json({ success: true });
    } catch (err) {
      logger.error(`DELETE /api/agents/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete agent.' });
    }
  });

  app.post('/api/agents/:id/run', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { input } = req.body || {};

    try {
      const result = await runAgentPipeline(id, req.user.sub, input || {});
      res.json(result);
    } catch (err) {
      logger.error(`POST /api/agents/:id/run failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/agents/:id/runs', requireAuth, async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    try {
      const runs = await getAgentRuns(id, req.user.sub, limit);
      res.json(runs);
    } catch (err) {
      logger.error(`GET /api/agents/:id/runs failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch runs.' });
    }
  });

  app.get('/api/agents/runs/active', requireAuth, async (req, res) => {
    try {
      const runs = await getActiveRuns(req.user.sub);
      res.json(runs);
    } catch (err) {
      logger.error(`GET /api/agents/runs/active failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch active runs.' });
    }
  });

  app.post('/api/agents/orchestrate', requireAuth, async (req, res) => {
    const { task } = req.body;

    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      return res.status(400).json({ error: 'Task description is required.' });
    }

    try {
      const result = await orchestrateTask(task.trim(), req.user.sub);
      res.json(result);
    } catch (err) {
      logger.error(`POST /api/agents/orchestrate failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });
};
