const express = require('express');
const request = require('supertest');

const mockPrisma = {
  $queryRaw: jest.fn(),
  user: { update: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  thread: { count: jest.fn(), findMany: jest.fn() },
  message: { count: jest.fn() },
  feedback: { count: jest.fn() },
};

jest.mock('../middleware/shared', () => ({
  prisma: mockPrisma,
  logger: { info: jest.fn(), error: jest.fn() },
  requireAdmin: async (req, res, next) => {
    const user = await mockPrisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  },
}));

jest.mock('../authMiddleware', () => (req, res, next) => {
  req.user = { sub: 'admin-user', email: 'admin@example.com', role: 'authenticated' };
  next();
});

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  const { requireAdmin } = require('../middleware/shared');
  require('../routes/admin')(app, { requireAdmin });
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/admin/users', () => {
  test('returns user list with stats for admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-user', role: 'admin' });
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'u1', email: 'a@test.com', role: 'user', threadCount: 5, messageCount: 20 },
    ]);

    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].email).toBe('a@test.com');
  });

  test('rejects non-admin users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-user', role: 'user' });

    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/admin/users/:userId/role', () => {
  test('updates role for admin user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-user', role: 'admin' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', role: 'admin' });

    const res = await request(app)
      .put('/api/admin/users/u1/role')
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'admin' },
    });
  });

  test('rejects invalid role value', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-user', role: 'admin' });

    const res = await request(app)
      .put('/api/admin/users/u1/role')
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid role.');
  });

  test('rejects non-admin attempting role change', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-user', role: 'user' });

    const res = await request(app)
      .put('/api/admin/users/u1/role')
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
  });
});
