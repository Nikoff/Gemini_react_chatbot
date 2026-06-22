require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { GoogleGenAI } = require('@google/genai');
const logger = require('./logger');
const requireAuth = require('./authMiddleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
const port = process.env.PORT || 5000;

const ALLOWED_MODELS = [
  'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash',
  'gemini-3.0-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash',
  'gemma-4-31b-it', 'gemma-4-26b-a4b-it',
];

const MAX_MESSAGES = 100;

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Validation Schemas ---

const syncSchema = z.object({
  email: z.string().email(),
});

const threadSchema = z.object({
  title: z.string().max(200).optional(),
});

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'ai']),
    text: z.string().min(1).max(10000),
  })).min(1).max(MAX_MESSAGES),
  model: z.string().optional(),
  threadId: z.string().uuid().optional(),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(-1).max(1),
  comment: z.string().max(1000).optional(),
});

const searchSchema = z.object({
  q: z.string().min(1).max(200),
});

// --- Auth Sync ---

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

// --- Threads ---

app.get('/api/threads', requireAuth, async (req, res) => {
  try {
    const threads = await prisma.thread.findMany({
      where: { userId: req.user.sub },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(threads);
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

// --- Messages (IDOR-protected) ---

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

// --- Request Logger ---

app.use((req, res, next) => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationMs = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2);
    const level = res.statusCode >= 400 ? 'error' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
});

// --- Chat (rate-limited, validated, model-allowlisted) ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/chat', requireAuth, chatLimiter, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body.', details: parsed.error.issues });
  }

  const { messages, model, threadId } = parsed.data;
  const targetModel = model || 'gemini-2.5-flash';
  const userId = req.user.sub;

  if (!ALLOWED_MODELS.includes(targetModel)) {
    return res.status(400).json({ error: 'Model not allowed.' });
  }

  logger.info(`Chat request from ${req.user.email} | model: ${targetModel}`);

  try {
    const formattedHistory = messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    const requestPayload = { model: targetModel, contents: formattedHistory };

    if (targetModel.includes('gemma')) {
      requestPayload.config = { temperature: 1.0, topP: 0.95, topK: 64 };
    }

    const response = await ai.models.generateContent(requestPayload);

    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;

    logger.info(`Gemini success | In(${promptTokens}) Out(${candidatesTokens})`);

    if (threadId) {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== userId) {
        return res.status(403).json({ error: 'Access denied to this thread.' });
      }

      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg) {
        await prisma.$transaction([
          prisma.message.createMany({
            data: [
              { threadId, role: 'user', content: lastUserMsg.text },
              { threadId, role: 'model', content: response.text, tokens: candidatesTokens },
            ],
          }),
          prisma.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
        ]);
      }
    }

    res.json({
      text: response.text,
      usage: { promptTokens, candidatesTokens, totalTokens: promptTokens + candidatesTokens },
      modelUsed: targetModel,
    });
  } catch (error) {
    logger.error(`Chat failed: ${error.message}`);
    res.status(500).json({ error: 'An error occurred during processing.' });
  }
});

// --- Feedback / Rating ---

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

// --- Message Search ---

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

    const messages = await prisma.message.findMany({
      where: {
        threadId,
        content: { contains: q, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });

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

// --- Thread Export ---

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
          md += `> Rating: ${fb.rating === 1 ? '👍' : '👎'}${fb.comment ? ` — ${fb.comment}` : ''}\n\n`;
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

// --- Global Error Handler ---

app.use((err, req, res, next) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// --- Graceful Shutdown ---

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Start Server ---

if (process.env.NODE_ENV !== 'test') {
  const jwtOk = process.env.SUPABASE_JWT_SECRET ? 'YES (len=' + process.env.SUPABASE_JWT_SECRET.length + ')' : 'MISSING';
  logger.info(`Startup: JWT_SECRET loaded: ${jwtOk}`);
  logger.info(`Startup: CORS origin: ${process.env.CORS_ORIGIN || 'ALL (development)'}`);
  logger.info(`Server running on port ${port}`);
  app.listen(port);
}

module.exports = app;
