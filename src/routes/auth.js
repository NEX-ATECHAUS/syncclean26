// src/routes/auth.js
const express = require('express');
const { z } = require('zod');
const { sendMagicLink, verifyMagicToken, refreshAccessToken } = require('../services/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/magic  — send magic link email
router.post('/magic', async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email' });

  try {
    await sendMagicLink(parsed.data.email);
    res.json({ ok: true, message: 'Magic link sent — check your email' });
  } catch (err) {
    console.error('Magic link error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// GET /api/auth/verify?token=...  — verify token, return JWTs
router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const result = verifyMagicToken(token);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

  try {
    const result = refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// GET /api/auth/me  — get current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.name } });
});

// PATCH /api/auth/me  — update name
router.patch('/me', requireAuth, (req, res) => {
  const { name } = req.body;
  if (typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
  const db = require('../db');
  db.prepare('UPDATE users SET name = ?, updated_at = unixepoch() WHERE id = ?')
    .run(name.trim(), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
