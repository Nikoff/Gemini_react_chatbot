require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('Supabase URL or Anon Key is undefined in middleware');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied: No token provided." });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.error(`Token verification failed: ${error?.message}`);
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token." });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error(`Auth exception: ${err.message}`);
    return res.status(500).json({ error: "Internal server error during authentication." });
  }
};

module.exports = authenticateToken;
