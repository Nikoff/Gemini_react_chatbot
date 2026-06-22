require('dotenv').config();
const jwt = require('jsonwebtoken');
const logger = require('./logger');

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('SUPABASE_JWT_SECRET is undefined — token verification will fail');
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied: No token provided." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      aud: payload.aud,
      exp: payload.exp,
    };

    next();
  } catch (err) {
    const reason = err.name === 'TokenExpiredError' ? 'token expired' : 'invalid signature';
    logger.error(`JWT verification failed: ${reason}`);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token." });
  }
};

module.exports = authenticateToken;
