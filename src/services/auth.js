// src/services/auth.js
const { v4: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const MAGIC_LINK_EXPIRES_MINUTES = parseInt(process.env.MAGIC_LINK_EXPIRES_MINUTES || '15');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Email transport ────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Send magic link ────────────────────────────────────────────────────────────
async function sendMagicLink(email) {
  email = email.toLowerCase().trim();

  // Upsert user
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const id = uuid();
    db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, email);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  // Invalidate old tokens for this email
  db.prepare('UPDATE magic_tokens SET used = 1 WHERE email = ? AND used = 0').run(email);

  // Create new token
  const token = uuid().replace(/-/g, '') + uuid().replace(/-/g, '');
  const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_EXPIRES_MINUTES * 60;
  db.prepare(
    'INSERT INTO magic_tokens (id, user_id, email, token, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), user.id, email, token, expiresAt);

  const link = `${FRONTEND_URL}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: `"${process.env.APP_NAME || "Clean'Sync"}" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `Your ${process.env.APP_NAME || "Clean'Sync"} sign-in link`,
    text: `Click to sign in (expires in ${MAGIC_LINK_EXPIRES_MINUTES} minutes):\n\n${link}\n\nIf you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Sign in to ${process.env.APP_NAME || "Clean'Sync"}</h2>
        <p style="color:#555;margin-bottom:24px">Click the button below to sign in. This link expires in ${MAGIC_LINK_EXPIRES_MINUTES} minutes.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#534AB7;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">Sign in →</a>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this email, you can safely ignore it.</p>
      </div>
    `,
  });

  return { ok: true };
}

// ── Verify magic link token → issue JWT ───────────────────────────────────────
function verifyMagicToken(token) {
  const row = db
    .prepare('SELECT * FROM magic_tokens WHERE token = ? AND used = 0')
    .get(token);

  if (!row) throw new Error('Invalid or already-used link');
  if (row.expires_at < Math.floor(Date.now() / 1000)) throw new Error('Link expired');

  // Mark used
  db.prepare('UPDATE magic_tokens SET used = 1 WHERE id = ?').run(row.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) throw new Error('User not found');

  const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  // Store refresh token
  const refreshToken = uuid().replace(/-/g, '') + uuid().replace(/-/g, '');
  const refreshExpires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(uuid(), user.id, refreshToken, refreshExpires);

  return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } };
}

// ── Refresh access token ───────────────────────────────────────────────────────
function refreshAccessToken(refreshToken) {
  const row = db
    .prepare('SELECT * FROM refresh_tokens WHERE token = ?')
    .get(refreshToken);

  if (!row || row.expires_at < Math.floor(Date.now() / 1000)) {
    throw new Error('Invalid or expired refresh token');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return { accessToken, user: { id: user.id, email: user.email, name: user.name } };
}

module.exports = { sendMagicLink, verifyMagicToken, refreshAccessToken };
