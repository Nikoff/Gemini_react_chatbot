const crypto = require('crypto');
const { prisma, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');

module.exports = function(app) {
  app.post('/api/threads/:threadId/share', requireAuth, async (req, res) => {
    const { threadId } = req.params;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      if (thread.shareToken) {
        return res.json({ shareToken: thread.shareToken, shareUrl: `/share/${thread.shareToken}` });
      }

      const shareToken = crypto.randomBytes(16).toString('hex');
      await prisma.thread.update({ where: { id: threadId }, data: { shareToken } });

      logger.info(`Thread ${threadId} shared with token ${shareToken}`);
      res.json({ shareToken, shareUrl: `/share/${shareToken}` });
    } catch (err) {
      logger.error(`Share failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to share thread.' });
    }
  });

  app.delete('/api/threads/:threadId/share', requireAuth, async (req, res) => {
    const { threadId } = req.params;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      await prisma.thread.update({ where: { id: threadId }, data: { shareToken: null } });
      res.json({ success: true });
    } catch (err) {
      logger.error(`Unshare failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to unshare thread.' });
    }
  });

  app.get('/api/shared/:shareToken', async (req, res) => {
    const { shareToken } = req.params;

    try {
      const thread = await prisma.thread.findUnique({
        where: { shareToken },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true, createdAt: true } },
          user: { select: { email: true } },
        },
      });

      if (!thread) {
        return res.status(404).json({ error: 'Shared conversation not found.' });
      }

      res.json({
        title: thread.title,
        author: thread.user.email,
        createdAt: thread.createdAt,
        messages: thread.messages.map(m => ({
          role: m.role === 'model' ? 'ai' : 'user',
          text: m.content,
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      logger.error(`Shared view failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to load shared conversation.' });
    }
  });
};
