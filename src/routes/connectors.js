// src/routes/connectors.js
const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../services/crypto');
const { listConnectorMeta, getConnector, HubSpotConnector, SalesforceConnector } = require('../connectors');
const { GoHighLevelConnector, ZohoConnector } = require('../connectors/platforms');
const db = require('../db');
require('dotenv').config();

const router = express.Router();
router.use(requireAuth);

// ── GET /api/connectors  — list user's connections ────────────────────────────
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, platform, display_name, auth_type, status, last_synced, created_at FROM connections WHERE user_id = ?')
    .all(req.user.id);
  const meta = listConnectorMeta();
  const connections = rows.map(r => ({ ...r, meta: meta[r.platform] || {} }));
  res.json({ connections, platforms: meta });
});

// ── POST /api/connectors  — add API-key connection ────────────────────────────
router.post('/', async (req, res) => {
  const { platform, credentials, displayName } = req.body;
  if (!platform || !credentials) return res.status(400).json({ error: 'platform and credentials required' });

  const meta = listConnectorMeta();
  if (!meta[platform]) return res.status(400).json({ error: 'Unknown platform' });

  try {
    const { getConnector: _, CONNECTORS } = require('../connectors');
    const Cls = CONNECTORS[platform];
    const connector = new Cls(credentials);
    await connector.testConnection();

    const id = uuid();
    db.prepare(
      'INSERT OR REPLACE INTO connections (id, user_id, platform, display_name, auth_type, credentials, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.user.id, platform, displayName || meta[platform].name, meta[platform].authType, encrypt(credentials), 'active');

    res.json({ ok: true, id, platform, status: 'active' });
  } catch (err) {
    res.status(400).json({ error: `Connection failed: ${err.message}` });
  }
});

// ── DELETE /api/connectors/:id ────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM connections WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── GET /api/connectors/:id/test ─────────────────────────────────────────────
router.get('/:id/test', async (req, res) => {
  try {
    const connector = getConnector(req.params.id, req.user.id);
    const result = await connector.testConnection();
    db.prepare('UPDATE connections SET status = ? WHERE id = ?').run('active', req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    db.prepare('UPDATE connections SET status = ? WHERE id = ?').run('error', req.params.id);
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/connectors/:id/modules ──────────────────────────────────────────
router.get('/:id/modules', async (req, res) => {
  try {
    const connector = getConnector(req.params.id, req.user.id);
    const modules = await connector.getModules();
    res.json({ modules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/connectors/:id/records/:module ───────────────────────────────────
router.get('/:id/records/:module', async (req, res) => {
  try {
    const connector = getConnector(req.params.id, req.user.id);
    const { page = 1, pageSize = 100 } = req.query;
    const result = await connector.getRecords(req.params.module, {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OAuth: redirect to platform ───────────────────────────────────────────────
router.get('/:platform/oauth/start', (req, res) => {
  const { platform } = req.params;
  // Store user id in state for callback
  const state = Buffer.from(JSON.stringify({ userId: req.user.id, platform })).toString('base64url');

  let url;
  if (platform === 'hubspot') {
    url = HubSpotConnector.getAuthUrl(process.env.HUBSPOT_CLIENT_ID, process.env.HUBSPOT_REDIRECT_URI);
  } else if (platform === 'salesforce') {
    url = SalesforceConnector.getAuthUrl(process.env.SALESFORCE_CLIENT_ID, process.env.SALESFORCE_REDIRECT_URI);
  } else if (platform === 'gohighlevel') {
    url = GoHighLevelConnector.getAuthUrl(process.env.GOHIGHLEVEL_CLIENT_ID, process.env.GOHIGHLEVEL_REDIRECT_URI);
  } else if (platform === 'zoho') {
    url = ZohoConnector.getAuthUrl(process.env.ZOHO_CLIENT_ID, process.env.ZOHO_REDIRECT_URI);
  } else {
    return res.status(400).json({ error: 'OAuth not supported for this platform' });
  }

  res.json({ url: url + `&state=${state}` });
});

// ── OAuth callbacks ────────────────────────────────────────────────────────────
async function handleOAuthCallback(platform, code, state, res) {
  let userId, credentials;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = decoded.userId;
  } catch {
    return res.status(400).send('Invalid state');
  }

  try {
    if (platform === 'hubspot') {
      credentials = await HubSpotConnector.exchangeCode(
        code, process.env.HUBSPOT_CLIENT_ID, process.env.HUBSPOT_CLIENT_SECRET, process.env.HUBSPOT_REDIRECT_URI
      );
    } else if (platform === 'salesforce') {
      credentials = await SalesforceConnector.exchangeCode(
        code, process.env.SALESFORCE_CLIENT_ID, process.env.SALESFORCE_CLIENT_SECRET, process.env.SALESFORCE_REDIRECT_URI
      );
    } else if (platform === 'gohighlevel') {
      credentials = await GoHighLevelConnector.exchangeCode(
        code, process.env.GOHIGHLEVEL_CLIENT_ID, process.env.GOHIGHLEVEL_CLIENT_SECRET, process.env.GOHIGHLEVEL_REDIRECT_URI
      );
    } else if (platform === 'zoho') {
      credentials = await ZohoConnector.exchangeCode(
        code, process.env.ZOHO_CLIENT_ID, process.env.ZOHO_CLIENT_SECRET, process.env.ZOHO_REDIRECT_URI
      );
    }

    const meta = listConnectorMeta();
    const id = uuid();
    db.prepare(
      'INSERT OR REPLACE INTO connections (id, user_id, platform, display_name, auth_type, credentials, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, platform, meta[platform].name, 'oauth2', encrypt(credentials), 'active');

    // Redirect back to frontend
    res.redirect(`${process.env.FRONTEND_URL}/connections?connected=${platform}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/connections?error=${encodeURIComponent(err.message)}`);
  }
}

router.get('/hubspot/callback',     (req, res) => handleOAuthCallback('hubspot',     req.query.code, req.query.state, res));
router.get('/salesforce/callback',  (req, res) => handleOAuthCallback('salesforce',  req.query.code, req.query.state, res));
router.get('/gohighlevel/callback', (req, res) => handleOAuthCallback('gohighlevel', req.query.code, req.query.state, res));
router.get('/zoho/callback',        (req, res) => handleOAuthCallback('zoho',        req.query.code, req.query.state, res));

module.exports = router;
