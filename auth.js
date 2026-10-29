const jwt = require('jsonwebtoken');
const crypto = require('crypto');

let secret = process.env.JWT_SECRET;
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('JWT_SECRET not set - using a random secret (logins reset on restart).');
}

const COOKIE = 'sf_token';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { uid: user.id, oid: user.organization_id },
    secret,
    { expiresIn: '7d' }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE);
}

// Attaches req.user = { id, orgId }. Every data query uses req.user.orgId
// so tenants can never see each other's rows.
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Please log in.' });
  try {
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.uid, orgId: payload.oid };
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth };
