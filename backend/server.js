require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const logger = require('./logger'); // NEW: Import logger
const requireAuth = require('./authMiddleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
const port = process.env.PORT || 5000;

// Standard Middleware
app.use(cors());
app.use(express.json());

// Creates the user record if it doesn't already exist in your local Postgres instance
app.post('/api/auth/sync', requireAuth, async (req, res) => {
  const { email } = req.body;
  const userId = req.user.sub; // Decoded directly from secure token metadata

  try {
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {}, // If user exists, do nothing
      create: {
        id: userId,
        email: email,
      },
    });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: "Failed to sync user structure" });
  }
});

// 1. GET ALL THREADS FOR LOGGED IN USER
app.get('/api/threads', requireAuth, async (req, res) => {
  const userId = req.user.sub; // Extracted safely from JWT token
  try {
    const threads = await prisma.thread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: "Failed to pull execution channels" });
  }
});

// 2. CREATE A FRESH NEW CHAT THREAD
app.post('/api/threads', requireAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email || `user-${userId}@placeholder.com`;

    if (!userId) {
       throw new Error("Missing user ID from authentication token.");
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: userEmail
      }
    });

    const newThread = await prisma.thread.create({
      data: {
        title: title || "New Chat",
        userId: userId, 
      }
    });

    logger.info(`Thread created: ${newThread.id} for user ${userId}`);
    res.json(newThread);

  } catch (error) {
    logger.error(`POST /api/threads failed: ${error.message}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. GET ALL HISTORICAL MESSAGES FOR A CHAT THREAD
app.get('/api/threads/:threadId/messages', requireAuth, async (req, res) => {
  const { threadId } = req.params;
  try {
    const dbMessages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
    
    // Map database structural models to your frontend 'user' | 'ai' format
    const UIFormatMessages = dbMessages.map(msg => ({
      role: msg.role === 'model' ? 'ai' : 'user',
      text: msg.content
    }));
    
    res.json(UIFormatMessages);
  } catch (err) {
    res.status(500).json({ error: "Failed to pull message stack" });
  }
});

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

// Initialize the Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Chat Route
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { messages, model, threadId } = req.body;
    const targetModel = model || "gemini-2.5-flash";
    const userId = req.user.sub;

    logger.info(`Auth verified for user ${req.user.email} | Target model: ${targetModel}`);

    const formattedHistory = messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    const requestPayload = {
      model: targetModel, 
      contents: formattedHistory,
    };

    if (targetModel.includes('gemma')) {
      requestPayload.config = { temperature: 1.0, topP: 0.95, topK: 64 };
    }

    const response = await ai.models.generateContent(requestPayload);

    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
    
    logger.info(`AI Core Success | Tokens spent: In(${promptTokens}) Out(${candidatesTokens})`);

    if (threadId) {
      const lastUserMsg = messages[messages.length - 1];
      await prisma.message.createMany({
        data: [
          { threadId, role: 'user', content: lastUserMsg.text },
          { threadId, role: 'model', content: response.text, tokens: candidatesTokens },
        ],
      });
      await prisma.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    }

    res.json({ 
      text: response.text,
      usage: { promptTokens, candidatesTokens, totalTokens: promptTokens + candidatesTokens },
      modelUsed: targetModel
    });
    
 } catch (error) {
    logger.error(`API Runtime Exception: ${error.message}`);
    res.status(500).json({ error: 'An error occurred during processing.' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info(`Server initialized securely on port ${port}`);
  });
}

app.use((err, req, res, next) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;