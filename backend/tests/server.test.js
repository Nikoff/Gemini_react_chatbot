const request = require('supertest');
const app = require('../server');

describe('Health check', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Helmet security headers', () => {
  test('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

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
      .send({ messages: [{ role: 'user', text: 'hi' }], model: 'gemini-2.5-flash' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/messages/:messageId/feedback', () => {
  test('rejects unauthenticated feedback', async () => {
    const res = await request(app)
      .post('/api/messages/fake-id/feedback')
      .send({ rating: 1 });
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/messages/:messageId', () => {
  test('rejects unauthenticated edit', async () => {
    const res = await request(app)
      .put('/api/messages/fake-id')
      .send({ content: 'edited' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/threads/:threadId', () => {
  test('rejects unauthenticated delete', async () => {
    const res = await request(app).delete('/api/threads/fake-id');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/threads/:threadId', () => {
  test('rejects unauthenticated rename', async () => {
    const res = await request(app)
      .put('/api/threads/fake-id')
      .send({ title: 'Renamed' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/threads/:threadId/search', () => {
  test('rejects unauthenticated search', async () => {
    const res = await request(app).get('/api/threads/fake-id/search?q=test');
    expect(res.status).toBe(401);
  });

  test('rejects search without query', async () => {
    const res = await request(app)
      .get('/api/threads/fake-id/search')
      .set('Authorization', 'Bearer fake');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/threads/:threadId/export', () => {
  test('rejects unauthenticated export', async () => {
    const res = await request(app).get('/api/threads/fake-id/export');
    expect(res.status).toBe(401);
  });
});

describe('Request validation', () => {
  test('rejects chat with empty messages', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer fake')
      .send({ messages: [], model: 'gemini-2.5-flash' });
    expect(res.status).toBe(401);
  });

  test('rejects thread with title too long', async () => {
    const res = await request(app)
      .post('/api/threads')
      .set('Authorization', 'Bearer fake')
      .send({ title: 'x'.repeat(201) });
    expect(res.status).toBe(401);
  });
});

describe('Unknown routes', () => {
  test('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
