const { prisma, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');
const { spendCredits, addCredits, CREDIT_COSTS } = require('../services/credits');

module.exports = function(app) {
  app.get('/api/marketplace', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const type = req.query.type || undefined;
    const category = req.query.category || undefined;
    const search = req.query.q || undefined;
    const sort = req.query.sort || 'popular';

    try {
      const where = { status: 'published' };
      if (type) where.type = type;
      if (category) where.category = category;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ];
      }

      const orderBy = sort === 'rating' ? { rating: 'desc' }
        : sort === 'newest' ? { createdAt: 'desc' }
        : sort === 'price-low' ? { price: 'asc' }
        : sort === 'price-high' ? { price: 'desc' }
        : { downloads: 'desc' };

      const items = await prisma.marketplaceItem.findMany({
        where,
        orderBy,
        take: limit,
        include: {
          user: { select: { id: true, email: true } },
          _count: { select: { purchases: true, reviews: true } },
        },
      });

      res.json(items.map(item => ({
        ...item,
        purchaseCount: item._count.purchases,
        reviewCount: item._count.reviews,
        _count: undefined,
      })));
    } catch (err) {
      logger.error(`GET /api/marketplace failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch marketplace.' });
    }
  });

  app.get('/api/marketplace/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const item = await prisma.marketplaceItem.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true } },
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { user: { select: { email: true } } },
          },
          _count: { select: { purchases: true, reviews: true } },
        },
      });

      if (!item) return res.status(404).json({ error: 'Item not found.' });
      if (item.status !== 'published' && item.userId !== req.user?.sub) {
        return res.status(404).json({ error: 'Item not found.' });
      }

      res.json({
        ...item,
        purchaseCount: item._count.purchases,
        reviewCount: item._count.reviews,
        _count: undefined,
      });
    } catch (err) {
      logger.error(`GET /api/marketplace/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch item.' });
    }
  });

  app.post('/api/marketplace', requireAuth, async (req, res) => {
    const { name, description, type, category, price, content, tags } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const validTypes = ['workflow', 'agent_template', 'style_preset', 'lora_pack', 'automation_template'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required.' });
    }

    try {
      const item = await prisma.marketplaceItem.create({
        data: {
          userId: req.user.sub,
          name: name.trim(),
          description: description || null,
          type,
          category: category || null,
          price: price || 0,
          content,
          tags: tags || [],
          status: 'published',
        },
      });

      logger.info(`Marketplace item created: ${item.id} by user ${req.user.sub}`);
      res.json(item);
    } catch (err) {
      logger.error(`POST /api/marketplace failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to create item.' });
    }
  });

  app.put('/api/marketplace/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, description, category, price, content, tags } = req.body;

    try {
      const item = await prisma.marketplaceItem.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ error: 'Item not found.' });
      if (item.userId !== req.user.sub) return res.status(403).json({ error: 'Access denied.' });

      const updated = await prisma.marketplaceItem.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(category !== undefined && { category }),
          ...(price !== undefined && { price }),
          ...(content !== undefined && { content }),
          ...(tags !== undefined && { tags }),
          version: { increment: 1 },
        },
      });

      res.json(updated);
    } catch (err) {
      logger.error(`PUT /api/marketplace/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to update item.' });
    }
  });

  app.delete('/api/marketplace/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
      const item = await prisma.marketplaceItem.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ error: 'Item not found.' });
      if (item.userId !== req.user.sub) return res.status(403).json({ error: 'Access denied.' });

      await prisma.marketplaceItem.delete({ where: { id } });
      logger.info(`Marketplace item deleted: ${id}`);
      res.json({ success: true });
    } catch (err) {
      logger.error(`DELETE /api/marketplace/:id failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete item.' });
    }
  });

  app.post('/api/marketplace/:id/purchase', requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.sub;

    try {
      const item = await prisma.marketplaceItem.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ error: 'Item not found.' });
      if (item.status !== 'published') return res.status(404).json({ error: 'Item not available.' });
      if (item.userId === userId) return res.status(400).json({ error: 'Cannot purchase your own item.' });

      const existing = await prisma.marketplacePurchase.findUnique({
        where: { itemId_userId: { itemId: id, userId } },
      });
      if (existing) return res.status(400).json({ error: 'Already purchased.' });

      if (item.price > 0) {
        const deduction = await spendCredits(userId, item.price, `marketplace:${id}`);
        if (!deduction.success) {
          return res.status(402).json({ error: 'Insufficient credits.', balance: deduction.balance, needed: deduction.needed });
        }

        const creatorEarnings = Math.floor(item.price * 0.8);
        await addCredits(item.userId, creatorEarnings, `marketplace_sale:${id}`);
      }

      await prisma.marketplacePurchase.create({
        data: { itemId: id, userId, creditsSpent: item.price },
      });

      await prisma.marketplaceItem.update({
        where: { id },
        data: { downloads: { increment: 1 } },
      });

      res.json({ success: true, content: item.content });
    } catch (err) {
      logger.error(`POST /api/marketplace/:id/purchase failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to purchase item.' });
    }
  });

  app.post('/api/marketplace/:id/review', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.sub;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1-5.' });
    }

    try {
      const item = await prisma.marketplaceItem.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ error: 'Item not found.' });

      const review = await prisma.marketplaceReview.upsert({
        where: { itemId_userId: { itemId: id, userId } },
        update: { rating, comment: comment || null },
        create: { itemId: id, userId, rating, comment: comment || null },
      });

      const avgResult = await prisma.marketplaceReview.aggregate({
        where: { itemId: id },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.marketplaceItem.update({
        where: { id },
        data: {
          rating: avgResult._avg.rating || 0,
          ratingCount: avgResult._count.rating,
        },
      });

      res.json(review);
    } catch (err) {
      logger.error(`POST /api/marketplace/:id/review failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to submit review.' });
    }
  });

  app.get('/api/marketplace/my-items', requireAuth, async (req, res) => {
    try {
      const items = await prisma.marketplaceItem.findMany({
        where: { userId: req.user.sub },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { purchases: true, reviews: true } } },
      });
      res.json(items.map(i => ({ ...i, purchaseCount: i._count.purchases, reviewCount: i._count.reviews, _count: undefined })));
    } catch (err) {
      logger.error(`GET /api/marketplace/my-items failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch items.' });
    }
  });
};
