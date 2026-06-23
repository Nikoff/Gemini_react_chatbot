const { prisma, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');
const { executeWorkflow } = require('../services/workflow-executor');

module.exports = function(app) {
  app.get('/api/workflows', requireAuth, async (req, res) => {
    const userId = req.user.sub;
    const includePublic = req.query.public === 'true';

    try {
      const where = includePublic
        ? { OR: [{ userId }, { isPublic: true }] }
        : { userId };

      const workflows = await prisma.workflow.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: { user: { select: { email: true } } },
      });

      res.json(workflows);
    } catch (err) {
      logger.error(`GET /api/workflows failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch workflows.' });
    }
  });

  app.get('/api/workflows/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: { user: { select: { email: true } } },
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found.' });
      }

      if (workflow.userId !== req.user.sub && !workflow.isPublic) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      res.json(workflow);
    } catch (err) {
      logger.error(`GET /api/workflows/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch workflow.' });
    }
  });

  app.post('/api/workflows', requireAuth, async (req, res) => {
    const { name, description, graph, isPublic } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (name.length > 200) {
      return res.status(400).json({ error: 'Name too long (max 200 chars).' });
    }

    if (!graph || typeof graph !== 'object') {
      return res.status(400).json({ error: 'Graph is required.' });
    }

    if (!graph.nodes || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      return res.status(400).json({ error: 'Graph must have at least one node.' });
    }

    try {
      const workflow = await prisma.workflow.create({
        data: {
          userId: req.user.sub,
          name: name.trim(),
          description: description || null,
          graph,
          isPublic: isPublic || false,
        },
      });

      logger.info(`Workflow created: ${workflow.id} by user ${req.user.sub}`);
      res.json(workflow);
    } catch (err) {
      logger.error(`POST /api/workflows failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to create workflow.' });
    }
  });

  app.put('/api/workflows/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, description, graph, isPublic } = req.body;

    try {
      const workflow = await prisma.workflow.findUnique({ where: { id } });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found.' });
      }

      if (workflow.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const updated = await prisma.workflow.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description }),
          ...(graph !== undefined && { graph }),
          ...(isPublic !== undefined && { isPublic }),
          version: { increment: 1 },
        },
      });

      res.json(updated);
    } catch (err) {
      logger.error(`PUT /api/workflows/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to update workflow.' });
    }
  });

  app.delete('/api/workflows/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
      const workflow = await prisma.workflow.findUnique({ where: { id } });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found.' });
      }

      if (workflow.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      await prisma.workflow.delete({ where: { id } });

      logger.info(`Workflow deleted: ${id} by user ${req.user.sub}`);
      res.json({ success: true });
    } catch (err) {
      logger.error(`DELETE /api/workflows/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete workflow.' });
    }
  });

  app.post('/api/workflows/:id/execute', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { input } = req.body || {};

    try {
      const result = await executeWorkflow(id, req.user.sub, input || {});
      res.json(result);
    } catch (err) {
      logger.error(`POST /api/workflows/:id/execute failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/workflows/:id/executions', requireAuth, async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    try {
      const workflow = await prisma.workflow.findUnique({ where: { id } });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found.' });
      }

      if (workflow.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const executions = await prisma.workflowExecution.findMany({
        where: { workflowId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          status: true,
          input: true,
          output: true,
          creditsUsed: true,
          error: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      });

      res.json(executions);
    } catch (err) {
      logger.error(`GET /api/workflows/:id/executions failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch executions.' });
    }
  });

  app.get('/api/workflows/marketplace', requireAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = req.query.q || '';

    try {
      const where = { isPublic: true };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const workflows = await prisma.workflow.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: { user: { select: { email: true } } },
      });

      res.json(workflows);
    } catch (err) {
      logger.error(`GET /api/workflows/marketplace failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch marketplace.' });
    }
  });
};
