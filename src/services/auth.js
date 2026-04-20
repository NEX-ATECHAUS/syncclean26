const { v4: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const https = require('https');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const MAGIC_LINK_EXPIRES_MINUTES = parseInt(process.env.MAGIC_LINK_EXPIRES_MINUTES || '15');
const FRONTEND_URL = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';

async function sendEmail(to, subject, html) {
  const body = JSON.stringify({
    from: `Clean'Sync <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
    to,
    subject,
    html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`Resend error ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendMagicLink(email) {
  email = email.toLowerCase().trim();

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const id = uuid();
    db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, email);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  db.prepare('UPDATE magic_tokens SET used = 1 WHERE email = ? AND used = 0').run(email);

  const token = uuid().replace(/-/g, '') + uuid().replace(/-/g, '');
  const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_EXPIRES_MINUTES * 60;
  db.prepare(
    'INSERT INTO magic_tokens (id, user_id, email, token, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), user.id, email, token, expiresAt);

  const link = `${FRONTEND_URL}/auth/verify?token=${token}`;

  await sendEmail(email, `Your Clean'Sync sign-in link`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Sign in to Clean'Sync</h2>
      <p style="color:#555;margin-bottom:24px">Click below to sign in. Expires in ${MAGIC_LINK_EXPIRES_MINUTES} minutes.</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#534AB7;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">Sign in →</a>
      <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, ignore it.</p>
    </div>
  `);

  return { ok: true };
}

function verifyMagicToken(token) {
  const row = db.prepare('SELECT * FROM magic_tokens WHERE token = ? AND used = 0').get(token);
  if (!row) throw new Error('Invalid or already-used link');
  if (row.expires_at < Math.floor(Date.now() / 1000)) throw new Error('Link expired');

  db.prepare('UPDATE magic_tokens SET used = 1 WHERE id = ?').run(row.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) throw new Error('User not found');

  const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  const refreshToken = uuid().replace(/-/g, '') + uuid().replace(/-/g, '');
  const refreshExpires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(uuid(), user.id, refreshToken, refreshExpires);

  return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } };
}

function refreshAccessToken(refreshToken) {
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
  if (!row || row.expires_at < Math.floor(Date.now() / 1000)) throw new Error('Invalid or expired refresh token');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { accessToken, user: { id: user.id, email: user.email, name: user.name } };
}

module.exports = { sendMagicLink, verifyMagicToken, refreshAccessToken };
