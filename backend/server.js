require('dotenv').config();
const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger, prisma, requireAdmin, checkSubscription, dailyCreditGrant } = require('./middleware/shared');
const { ComfyUIClient } = require('./services/comfyui');

const app = express();
const port = process.env.PORT || 5000;

app.set('trust proxy', 1);

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

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

app.use('/api/', globalLimiter);
app.use('/api/', dailyCreditGrant);

const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many image generation requests.' },
});

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many agent requests.' },
});

const marketplaceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many marketplace requests.' },
});

const timeout = (ms) => (req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timed out.' });
    }
  }, ms);
  res.on('finish', () => clearTimeout(timer));
  next();
};

const comfyui = new ComfyUIClient(process.env.COMFYUI_URL || 'http://127.0.0.1:8188');

app.get('/api/health', async (req, res) => {
  const mem = process.memoryUsage();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: { rss: mem.rss, heapUsed: mem.heapUsed },
    services: {},
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  health.services.gemini = process.env.GEMINI_API_KEY ? 'configured' : 'missing';

  try {
    await comfyui.getSystemStats();
    health.services.comfyui = 'available';
  } catch {
    health.services.comfyui = 'unavailable';
  }

  res.json(health);
});

const pathTimeout = (pattern, ms) => (req, res, next) => {
  if (!req.path.startsWith(pattern)) return next();
  const timer = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ error: 'Request timed out.' });
  }, ms);
  res.on('finish', () => clearTimeout(timer));
  next();
};

const pathLimiter = (pattern, limiter) => (req, res, next) => {
  if (!req.path.startsWith(pattern)) return next();
  limiter(req, res, next);
};

app.use(pathTimeout('/api/generate', 120000));
app.use(pathTimeout('/api/agents', 300000));

app.use(pathLimiter('/api/generate', imageLimiter));
app.use(pathLimiter('/api/agents', agentLimiter));
app.use(pathLimiter('/api/marketplace', marketplaceLimiter));

require('./routes/auth')(app);
require('./routes/threads')(app);
require('./routes/chat')(app, { checkSubscription, chatLimiter });
require('./routes/share')(app);
require('./routes/subscription')(app);
require('./routes/admin')(app, { requireAdmin });
require('./routes/messages')(app);
require('./routes/generate')(app, { checkSubscription, chatLimiter });
require('./routes/workflows')(app);
require('./routes/agents')(app);
require('./routes/marketplace')(app);

app.use((req, res, next) => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationMs = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2);
    const level = res.statusCode >= 400 ? 'error' : 'info';
    logger[level](`[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function shutdown(signal) {
  logger.info(`${signal} received \u2014 shutting down`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  const jwtOk = process.env.SUPABASE_JWT_SECRET ? 'YES (len=' + process.env.SUPABASE_JWT_SECRET.length + ')' : 'MISSING';
  logger.info(`Startup: JWT_SECRET loaded: ${jwtOk}`);
  logger.info(`Startup: CORS origin: ${process.env.CORS_ORIGIN || 'ALL (development)'}`);
  logger.info(`Server running on port ${port}`);
  app.listen(port);
}

module.exports = app;
