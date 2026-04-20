// src/routes/custom.js
// Handles connections created via AI doc-reading (any REST API)
const express = require('express');
const { v4: uuid } = require('uuid');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../services/crypto');
const db = require('../db');

const router = express.Router();
router.use(requireAuth);

// GET /api/custom  — list custom connections
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, docs_url, base_url, modules, status, created_at FROM custom_connections WHERE user_id = ?')
    .all(req.user.id);
  res.json({ connections: rows.map(r => ({ ...r, modules: JSON.parse(r.modules || '[]') })) });
});

// POST /api/custom  — save a custom connection after AI analysis
router.post('/', async (req, res) => {
  const { name, docsUrl, baseUrl, authConfig, modules, fields } = req.body;
  if (!name || !baseUrl || !authConfig) {
    return res.status(400).json({ error: 'name, baseUrl, authConfig required' });
  }

  // Test the connection before saving
  try {
    const headers = buildAuthHeaders(authConfig);
    // Try to hit a known endpoint from the first module
    const testEndpoint = modules?.[0]?.endpoint;
    if (testEndpoint) {
      await axios.get(`${baseUrl}${testEndpoint}`, { headers, params: { limit: 1, per_page: 1 }, timeout: 8000 });
    }
  } catch (err) {
    // Don't block save on test failure — network issues shouldn't prevent saving config
    console.warn('Custom connection test warning:', err.message);
  }

  const id = uuid();
  db.prepare(
    'INSERT INTO custom_connections (id, user_id, name, docs_url, base_url, auth_config, modules, fields, status) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(
    id, req.user.id, name, docsUrl || null, baseUrl,
    encrypt(authConfig),
    JSON.stringify(modules || []),
    JSON.stringify(fields || {}),
    'active'
  );

  res.json({ ok: true, id });
});

// GET /api/custom/:id/records/:module  — fetch records from custom API
router.get('/:id/records/:module', async (req, res) => {
  const conn = db
    .prepare('SELECT * FROM custom_connections WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });

  const authConfig = decrypt(conn.auth_config);
  const modules = JSON.parse(conn.modules || '[]');
  const mod = modules.find(m => m.name.toLowerCase() === req.params.module.toLowerCase() || m.endpoint === req.params.module);
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  try {
    const headers = buildAuthHeaders(authConfig);
    const { page = 1, pageSize = 100 } = req.query;
    const res2 = await axios.get(`${conn.base_url}${mod.endpoint}`, {
      headers,
      params: { page, per_page: pageSize, limit: pageSize },
      timeout: 15000,
    });

    // Try to extract records array from common response shapes
    const data = res2.data;
    const records =
      Array.isArray(data) ? data :
      Array.isArray(data?.data) ? data.data :
      Array.isArray(data?.results) ? data.results :
      Array.isArray(data?.items) ? data.items :
      Array.isArray(data?.records) ? data.records :
      Array.isArray(data?.contacts) ? data.contacts :
      [];

    res.json({ records: records.map(r => ({ _id: r.id || r._id, _source: conn.name, ...r })), total: data?.total || records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/custom/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM custom_connections WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildAuthHeaders(authConfig) {
  const { type, api_key, header_name, header_format, bearer_token, username, password } = authConfig;

  if (type === 'api_key' || type === 'bearer') {
    const key = api_key || bearer_token || '';
    const headerVal = (header_format || 'Bearer {key}').replace('{key}', key).replace('{api_key}', key);
    return { [header_name || 'Authorization']: headerVal };
  }
  if (type === 'basic') {
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  if (type === 'oauth2') {
    return { Authorization: `Bearer ${authConfig.access_token}` };
  }
  return {};
}

module.exports = router;
