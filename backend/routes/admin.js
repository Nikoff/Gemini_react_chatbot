const { prisma, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');

module.exports = function(app, { requireAdmin }) {
  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const usersWithStats = await prisma.$queryRaw`
        SELECT u.id, u.email, u.role, u."createdAt",
          COALESCE(t.cnt, 0)::int as "threadCount",
          COALESCE(m.cnt, 0)::int as "messageCount"
        FROM "User" u
        LEFT JOIN (SELECT "userId", COUNT(*) as cnt FROM "Thread" GROUP BY "userId") t ON t."userId" = u.id
        LEFT JOIN (
          SELECT th."userId", COUNT(*) as cnt
          FROM "Message" msg JOIN "Thread" th ON msg."threadId" = th.id
          GROUP BY th."userId"
        ) m ON m."userId" = u.id
        ORDER BY u."createdAt" DESC
      `;

      res.json(usersWithStats);
    } catch (err) {
      logger.error(`Admin users failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch users.' });
    }
  });

  app.put('/api/admin/users/:userId/role', requireAuth, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    try {
      await prisma.user.update({ where: { id: userId }, data: { role } });
      res.json({ success: true });
    } catch (err) {
      logger.error(`Admin role update failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to update role.' });
    }
  });

  app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
      const totalUsers = await prisma.user.count();
      const totalThreads = await prisma.thread.count();
      const totalMessages = await prisma.message.count();
      const totalFeedbacks = await prisma.feedback.count();

      const recentThreads = await prisma.thread.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, createdAt: true, user: { select: { email: true } } },
      });

      const modelUsage = await prisma.message.groupBy({
        by: ['role'],
        _count: true,
      });

      res.json({
        totalUsers,
        totalThreads,
        totalMessages,
        totalFeedbacks,
        recentThreads,
        modelUsage,
      });
    } catch (err) {
      logger.error(`Admin stats failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch stats.' });
    }
  });

  app.delete('/api/admin/threads/:threadId', requireAuth, requireAdmin, async (req, res) => {
    const { threadId } = req.params;

    try {
      await prisma.thread.delete({ where: { id: threadId } });
      res.json({ success: true });
    } catch (err) {
      logger.error(`Admin thread delete failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete thread.' });
    }
  });
};
