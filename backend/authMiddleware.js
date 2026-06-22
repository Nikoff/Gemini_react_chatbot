require('dotenv').config();
const logger = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
let JWKS;

async function loadJWKS() {
  if (!JWKS) {
    const { createRemoteJWKSet } = await import('jose');
    JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return JWKS;
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied: No token provided." });
  }

  try {
    const { jwtVerify } = await import('jose');
    const jwks = await loadJWKS();

    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${supabaseUrl}/auth/v1`,
    });

    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      aud: payload.aud,
      exp: payload.exp,
    };

    next();
  } catch (err) {
    logger.error(`JWT verification failed: ${err.message}`);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token." });
  }
};

module.exports = authenticateToken;
