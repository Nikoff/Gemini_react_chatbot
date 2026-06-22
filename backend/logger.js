const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Custom format to keep terminal logs clean and human-readable
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
  })
);

// Configure Daily Rotation for structural troubleshooting files
const fileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, 'logs', 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d', // Automatically purge logs older than 14 days
  maxSize: '20m',  // Rotate file if it exceeds 20 Megabytes
  level: 'info'
});

// Configure separate rotation for critical errors only
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(__dirname, 'logs', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  maxSize: '20m',
  level: 'error'
});

const logger = winston.createLogger({
  format: logFormat,
  transports: [
    new winston.transports.Console({ level: 'debug' }), // Real-time CLI feedback
    fileTransport,
    errorFileTransport
  ]
});

module.exports = logger;