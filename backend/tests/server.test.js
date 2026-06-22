const request = require('supertest');
const app = require('../server');

describe('Auth middleware', () => {
  test('rejects request without token', async () => {
    const res = await request(app).get('/api/threads');
    expect(res.status).toBe(401);
  });

  test('rejects request with invalid token', async () => {
    const res = await request(app)
      .get('/api/threads')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/sync', () => {
  test('rejects unauthenticated sync', async () => {
    const res = await request(app)
      .post('/api/auth/sync')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/threads', () => {
  test('rejects unauthenticated thread creation', async () => {
    const res = await request(app)
      .post('/api/threads')
      .send({ title: 'Test' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/threads', () => {
  test('rejects unauthenticated thread listing', async () => {
    const res = await request(app).get('/api/threads');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/threads/:threadId/messages', () => {
  test('rejects unauthenticated message fetching', async () => {
    const res = await request(app).get('/api/threads/fake-id/messages');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/chat', () => {
  test('rejects unauthenticated chat', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [], model: 'gemini-2.5-flash' });
    expect(res.status).toBe(401);
  });
});

describe('Unknown routes', () => {
  test('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
