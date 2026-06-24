const jwt = require('jose');

const TEST_SECRET = new TextEncoder().encode('test-secret-key-for-unit-tests-only');

function generateTestToken(payload = {}) {
  const defaultPayload = {
    sub: 'test-user-id-123',
    email: 'test@example.com',
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  };
  return jwt.SignJWT(defaultPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(TEST_SECRET);
}

function generateAdminToken() {
  return generateTestToken({
    sub: 'admin-user-id-456',
    email: 'admin@example.com',
    role: 'authenticated',
  });
}

function generateExpiredToken() {
  return generateTestToken({
    exp: Math.floor(Date.now() / 1000) - 3600,
  });
}

module.exports = { generateTestToken, generateAdminToken, generateExpiredToken, TEST_SECRET };
