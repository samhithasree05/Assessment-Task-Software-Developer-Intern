const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { setAuthCookie, clearAuthCookie, requireAuth } = require('../auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const orgName = String(req.body.organizationName || '').trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!orgName) return res.status(400).json({ error: 'Organization name is required.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const create = db.transaction(() => {
    const org = db.prepare('INSERT INTO organizations (name) VALUES (?)').run(orgName);
    const user = db
      .prepare('INSERT INTO users (email, password_hash, organization_id) VALUES (?, ?, ?)')
      .run(email, hash, org.lastInsertRowid);
    return { id: user.lastInsertRowid, organization_id: org.lastInsertRowid };
  });
  const user = create();
  setAuthCookie(res, user);
  res.status(201).json({ email, organizationName: orgName });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(user.organization_id);
  setAuthCookie(res, user);
  res.json({ email: user.email, organizationName: org.name });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT u.email, o.name AS organizationName
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ?`
    )
    .get(req.user.id);
  if (!row) return res.status(401).json({ error: 'Account not found.' });
  res.json(row);
});

module.exports = router;
