const { prisma, threadSchema, searchSchema, systemPromptSchema, ai, CONTEXT_COMPRESS_THRESHOLD, CONTEXT_KEEP_RECENT, TIERS, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');

module.exports = function(app) {
  app.get('/api/threads', requireAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const cursor = req.query.cursor || undefined;

    try {
      const where = { userId: req.user.sub };
      const threads = await prisma.thread.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      const hasMore = threads.length > limit;
      const items = hasMore ? threads.slice(0, limit) : threads;

      res.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
    } catch (err) {
      logger.error(`GET /api/threads failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch threads.' });
    }
  });

  app.post('/api/threads', requireAuth, async (req, res) => {
    const parsed = threadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const userId = req.user.sub;

    try {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: req.user.email },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });
      const tier = user?.subscription?.status === 'active' ? 'pro' : 'free';
      const limits = TIERS[tier];

      if (limits.maxThreads > 0) {
        const threadCount = await prisma.thread.count({ where: { userId } });
        if (threadCount >= limits.maxThreads) {
          return res.status(429).json({ error: `Thread limit reached (${limits.maxThreads}). Upgrade to Pro for unlimited threads.` });
        }
      }

      const newThread = await prisma.thread.create({
        data: { title: parsed.data.title || 'New Chat', userId },
      });

      logger.info(`Thread created: ${newThread.id} for user ${userId}`);
      res.json(newThread);
    } catch (error) {
      logger.error(`POST /api/threads failed: ${error.message}`);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/threads/:threadId/messages', requireAuth, async (req, res) => {
    const { threadId } = req.params;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      const dbMessages = await prisma.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
      });

      const uiMessages = dbMessages.map(msg => ({
        role: msg.role === 'model' ? 'ai' : 'user',
        text: msg.content,
      }));

      res.json(uiMessages);
    } catch (err) {
      logger.error(`GET /api/threads/:threadId/messages failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch messages.' });
    }
  });

  app.delete('/api/threads/:threadId', requireAuth, async (req, res) => {
    const { threadId } = req.params;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      await prisma.thread.delete({ where: { id: threadId } });

      logger.info(`Thread deleted: ${threadId} by user ${req.user.sub}`);
      res.json({ success: true });
    } catch (err) {
      logger.error(`DELETE /api/threads/:threadId failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete thread.' });
    }
  });

  app.put('/api/threads/:threadId', requireAuth, async (req, res) => {
    const parsed = threadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const { threadId } = req.params;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      const updated = await prisma.thread.update({
        where: { id: threadId },
        data: { title: parsed.data.title || thread.title },
      });

      res.json(updated);
    } catch (err) {
      logger.error(`PUT /api/threads/:threadId failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to rename thread.' });
    }
  });

  app.put('/api/threads/:threadId/system-prompt', requireAuth, async (req, res) => {
    const parsed = systemPromptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const { threadId } = req.params;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      const updated = await prisma.thread.update({
        where: { id: threadId },
        data: { systemPrompt: parsed.data.systemPrompt },
      });

      res.json({ systemPrompt: updated.systemPrompt });
    } catch (err) {
      logger.error(`PUT /api/threads/:threadId/system-prompt failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to update system prompt.' });
    }
  });

  app.post('/api/threads/:threadId/compress', requireAuth, async (req, res) => {
    const { threadId } = req.params;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      const allMessages = await prisma.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
      });

      if (allMessages.length <= CONTEXT_COMPRESS_THRESHOLD) {
        return res.json({ compressed: false, messageCount: allMessages.length });
      }

      const toSummarize = allMessages.slice(0, allMessages.length - CONTEXT_KEEP_RECENT);

      const conversationText = toSummarize.map(m =>
        `${m.role === 'model' ? 'AI' : 'User'}: ${m.content.substring(0, 500)}`
      ).join('\n');

      const summaryResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Summarize this conversation concisely in 2-3 paragraphs, preserving key decisions, facts, and context:\n\n${conversationText}` }] }],
      });

      const summary = summaryResponse.text;
      const summaryTokens = toSummarize.reduce((sum, m) => sum + (m.tokens || 0), 0);

      await prisma.$transaction([
        prisma.message.deleteMany({ where: { id: { in: toSummarize.map(m => m.id) } } }),
        prisma.message.create({
          data: {
            threadId,
            role: 'model',
            content: `[Conversation Summary]\n${summary}`,
            tokens: summaryTokens,
          },
        }),
      ]);

      logger.info(`Compressed thread ${threadId}: ${toSummarize.length} messages -> summary`);
      res.json({ compressed: true, messageCount: allMessages.length, removedCount: toSummarize.length });

    } catch (err) {
      logger.error(`Compress failed: ${err.message}`);
      res.status(500).json({ error: 'Compression failed.' });
    }
  });

  app.get('/api/threads/:threadId/search', requireAuth, async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameter.' });
    }

    const { threadId } = req.params;
    const { q } = parsed.data;

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      const messages = await prisma.$queryRaw`
        SELECT id, role, content, "createdAt"
        FROM "Message"
        WHERE "threadId" = ${threadId}
          AND to_tsvector('english', content) @@ plainto_tsquery('english', ${q})
        ORDER BY "createdAt" ASC
      `;

      if (messages.length === 0) {
        const fallback = await prisma.message.findMany({
          where: { threadId, content: { contains: q, mode: 'insensitive' } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        });
        return res.json(fallback.map(m => ({
          id: m.id,
          role: m.role === 'model' ? 'ai' : 'user',
          text: m.content,
          createdAt: m.createdAt,
        })));
      }

      res.json(messages.map(m => ({
        id: m.id,
        role: m.role === 'model' ? 'ai' : 'user',
        text: m.content,
        createdAt: m.createdAt,
      })));
    } catch (err) {
      logger.error(`GET /api/threads/:threadId/search failed: ${err.message}`);
      res.status(500).json({ error: 'Search failed.' });
    }
  });

  app.get('/api/threads/:threadId/export', requireAuth, async (req, res) => {
    const { threadId } = req.params;
    const format = req.query.format || 'json';

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      const messages = await prisma.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
        include: { feedbacks: { select: { rating: true, comment: true } } },
      });

      if (format === 'md') {
        let md = `# ${thread.title}\n\n`;
        md += `Exported: ${new Date().toISOString()}\n\n---\n\n`;
        for (const msg of messages) {
          const role = msg.role === 'model' ? 'AI' : 'User';
          md += `### ${role}\n\n${msg.content}\n\n`;
          const fb = msg.feedbacks[0];
          if (fb) {
            md += `> Rating: ${fb.rating === 1 ? '\ud83d\udc4d' : '\ud83d\udc4e'}${fb.comment ? ` \u2014 ${fb.comment}` : ''}\n\n`;
          }
        }
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${thread.title}.md"`);
        return res.send(md);
      }

      const exportData = {
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        exportedAt: new Date().toISOString(),
        messages: messages.map(msg => ({
          role: msg.role === 'model' ? 'ai' : 'user',
          content: msg.content,
          tokens: msg.tokens,
          createdAt: msg.createdAt,
          feedback: msg.feedbacks[0] || null,
        })),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${thread.title}.json"`);
      res.json(exportData);
    } catch (err) {
      logger.error(`GET /api/threads/:threadId/export failed: ${err.message}`);
      res.status(500).json({ error: 'Export failed.' });
    }
  });
};
