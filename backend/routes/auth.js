const { prisma, syncSchema, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');

module.exports = function(app) {
  app.post('/api/auth/sync', requireAuth, async (req, res) => {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const userId = req.user.sub;
    const email = req.user.email || parsed.data.email;

    try {
      const user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email },
      });
      res.status(200).json({ success: true, user });
    } catch (error) {
      logger.error(`Auth sync failed: ${error.message}`);
      res.status(500).json({ error: 'Failed to sync user.' });
    }
  });
};
