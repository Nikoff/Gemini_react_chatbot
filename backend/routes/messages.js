const { prisma, feedbackSchema, editSchema, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');

module.exports = function(app) {
  app.post('/api/messages/:messageId/feedback', requireAuth, async (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const { messageId } = req.params;
    const userId = req.user.sub;

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { thread: true },
      });

      if (!message || message.thread.userId !== userId) {
        return res.status(404).json({ error: 'Message not found.' });
      }

      const feedback = await prisma.feedback.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { rating: parsed.data.rating, comment: parsed.data.comment },
        create: { messageId, userId, rating: parsed.data.rating, comment: parsed.data.comment },
      });

      res.json(feedback);
    } catch (err) {
      logger.error(`POST /api/messages/:messageId/feedback failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to save feedback.' });
    }
  });

  app.put('/api/messages/:messageId', requireAuth, async (req, res) => {
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const { messageId } = req.params;
    const userId = req.user.sub;

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { thread: true },
      });

      if (!message || message.thread.userId !== userId) {
        return res.status(404).json({ error: 'Message not found.' });
      }

      if (message.role !== 'user') {
        return res.status(400).json({ error: 'Only user messages can be edited.' });
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content: parsed.data.content, editedAt: new Date() },
      });

      res.json({ id: updated.id, content: updated.content, editedAt: updated.editedAt });
    } catch (err) {
      logger.error(`PUT /api/messages/:messageId failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to edit message.' });
    }
  });
};
