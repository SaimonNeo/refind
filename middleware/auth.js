// middleware/auth.js
const jwt = require('jsonwebtoken');
const { get } = require('../database/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Requires a valid JWT in the Authorization header ("Bearer <token>").
 * Attaches { id, email, role } to req.user. Also re-checks the account's
 * suspension flag on every request so a suspension takes effect immediately,
 * not just on next login.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = get('SELECT id, suspended FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    if (user.suspended) return res.status(403).json({ error: 'This account has been suspended. Contact an administrator.' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Requires req.user.role === 'admin'. Must run after requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { requireAuth, requireAdmin, signToken, JWT_SECRET };
