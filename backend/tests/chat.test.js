const express = require('express');
const request = require('supertest');

const mockPrisma = {
  thread: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
  message: { createMany: jest.fn(), create: jest.fn() },
};

const mockChunks = [];
function setMockChunks(chunks) {
  mockChunks.length = 0;
  mockChunks.push(...chunks);
}

const mockAI = {
  models: {
    generateContentStream: jest.fn().mockImplementation(async () => ({
      [Symbol.asyncIterator]() {
        let idx = 0;
        return {
          next() {
            if (idx < mockChunks.length) {
              return Promise.resolve({ value: mockChunks[idx++], done: false });
            }
            return Promise.resolve({ done: true });
          },
        };
      },
    })),
  },
};

jest.mock('../middleware/shared', () => ({
  prisma: mockPrisma,
  ai: mockAI,
  chatSchema: {
    safeParse: (data) => {
      if (!data.messages || !data.messages.length) return { success: false, error: { issues: [] } };
      return { success: true, data };
    },
  },
  ALLOWED_MODELS: ['gemini-2.5-flash', 'gemini-2.0-flash'],
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('../authMiddleware', () => (req, res, next) => {
  req.user = { sub: 'test-user', email: 'test@example.com', role: 'authenticated' };
  next();
});

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  const noop = (req, res, next) => next();
  require('../routes/chat')(app, { checkSubscription: noop, chatLimiter: noop });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.thread.findUnique.mockResolvedValue(null);
});

describe('POST /api/chat', () => {
  test('returns SSE stream with chunk and done events', async () => {
    setMockChunks([
      { text: 'Hello' },
      { text: ' world' },
      { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } },
    ]);

    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', text: 'Hi' }], model: 'gemini-2.5-flash' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"chunk"');
    expect(res.text).toContain('"type":"done"');
    expect(res.text).toContain('Hello');
  });

  test('rejects request with empty messages', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [] });

    expect(res.status).toBe(400);
  });

  test('rejects disallowed model', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', text: 'Hi' }], model: 'banned-model' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Model not allowed.');
  });
});

describe('Calculator tool (unit test via mathjs)', () => {
  const { evaluate } = require('mathjs');

  test('evaluates safe calculator expression', () => {
    const result = String(evaluate('2+3'));
    expect(result).toBe('5');
  });

  test('evaluates complex expression', () => {
    const result = String(evaluate('2+3*4'));
    expect(result).toBe('14');
  });

  test('rejects malicious input via mathjs', () => {
    expect(() => evaluate('require("child_process")')).toThrow();
  });

  test('rejects code execution attempts', () => {
    expect(() => evaluate('process.exit(0)')).toThrow();
  });
});
