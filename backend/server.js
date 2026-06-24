require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger, prisma, requireAdmin, checkSubscription, dailyCreditGrant } = require('./middleware/shared');

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
app.use('/api/', globalLimiter);
app.use('/api/', dailyCreditGrant);

app.get('/api/health', async (req, res) => {
  const health = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'ok';
  } catch {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  res.json(health);
});

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
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
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
