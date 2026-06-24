require('dotenv').config();
const { z } = require('zod');
const { GoogleGenAI } = require('@google/genai');
const { PrismaClient } = require('@prisma/client');
const logger = require('../logger');

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const ALLOWED_MODELS = [
  'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash',
  'gemini-3.0-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash',
  'gemma-4-31b-it', 'gemma-4-26b-a4b-it',
];

const MAX_MESSAGES = 100;
const CONTEXT_COMPRESS_THRESHOLD = 80;
const CONTEXT_KEEP_RECENT = 10;

const TIERS = {
  free: { maxMessages: 50, maxThreads: 3, models: ['gemini-2.5-flash'] },
  pro: { maxMessages: -1, maxThreads: -1, models: null },
  team: { maxMessages: -1, maxThreads: -1, models: null },
};

const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRO_PRICE_ID,
  team_monthly: process.env.STRIPE_TEAM_PRICE_ID,
};

const syncSchema = z.object({
  email: z.string().email(),
});

const threadSchema = z.object({
  title: z.string().max(200).optional(),
});

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'ai']),
    text: z.string().min(0).max(10000),
    image: z.object({
      data: z.string().max(10485760),
      mimeType: z.string(),
    }).optional(),
    audio: z.object({
      data: z.string().max(10485760),
      mimeType: z.string(),
    }).optional(),
  })).min(1).max(MAX_MESSAGES),
  model: z.string().optional(),
  threadId: z.string().uuid().optional(),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(-1).max(1),
  comment: z.string().max(1000).optional(),
});

const editSchema = z.object({
  content: z.string().min(1).max(10000),
});

const searchSchema = z.object({
  q: z.string().min(1).max(200),
});

const systemPromptSchema = z.object({
  systemPrompt: z.string().max(5000).nullable(),
});

const requireAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authorization check failed.' });
  }
};

const checkSubscription = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { subscription: true },
    });

    const tier = user?.subscription?.status === 'active' ? 'pro' : 'free';
    const limits = TIERS[tier];

    req.subscriptionTier = tier;
    req.subscriptionLimits = limits;

    if (tier === 'free') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const msgCount = await prisma.message.count({
        where: {
          thread: { userId: req.user.sub },
          createdAt: { gte: today },
          role: 'user',
        },
      });
      if (msgCount >= limits.maxMessages) {
        return res.status(429).json({ error: 'Daily message limit reached. Upgrade to Pro for unlimited messages.' });
      }
    }

    next();
  } catch (err) {
    logger.error(`checkSubscription failed: ${err.message}`);
    return res.status(500).json({ error: 'Subscription verification failed.' });
  }
};

module.exports = {
  prisma,
  ai,
  stripe,
  logger,
  ALLOWED_MODELS,
  MAX_MESSAGES,
  CONTEXT_COMPRESS_THRESHOLD,
  CONTEXT_KEEP_RECENT,
  TIERS,
  STRIPE_PRICES,
  syncSchema,
  threadSchema,
  chatSchema,
  feedbackSchema,
  editSchema,
  searchSchema,
  systemPromptSchema,
  requireAdmin,
  checkSubscription,
  dailyCreditGrant: async (req, res, next) => {
    try {
      if (!req.user?.sub) return next();
      const { grantDailyCredits } = require('../services/credits');
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        include: { subscription: true },
      });
      const tier = user?.subscription?.status === 'active' ? 'pro' : 'free';
      await grantDailyCredits(req.user.sub, tier);
    } catch (err) { logger.error(`dailyCreditGrant failed for ${req.user?.sub}: ${err.message}`); }
    next();
  },
};
