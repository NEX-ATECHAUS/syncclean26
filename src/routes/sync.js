// src/routes/sync.js
const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { runSyncJob, findLocalDuplicates } = require('../services/sync');
const { getConnector } = require('../connectors');
const db = require('../db');

const router = express.Router();
router.use(requireAuth);

// GET /api/sync/jobs
router.get('/jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM sync_jobs WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ jobs: jobs.map(j => ({ ...j, stats: JSON.parse(j.stats || '{}') })) });
});

// POST /api/sync/jobs — create a job
router.post('/jobs', (req, res) => {
  const { sourceId, destinationId, fieldMap, dedupRules, mergeStrategy, schedule, direction, conflictPolicy } = req.body;
  if (!sourceId || !destinationId) return res.status(400).json({ error: 'sourceId and destinationId required' });

  const id = uuid();
  db.prepare(
    'INSERT INTO sync_jobs (id, user_id, source_id, destination_id, direction, field_map, dedup_rules, merge_strategy, schedule, conflict_policy) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, req.user.id, sourceId, destinationId, direction || 'one_way', JSON.stringify(fieldMap || {}), JSON.stringify(dedupRules || {}), mergeStrategy || 'most_complete', schedule || 'manual', conflictPolicy || 'newest_wins');

  res.json({ ok: true, id });
});

// POST /api/sync/jobs/:id/run — run a job with SSE progress stream
router.post('/jobs/:id/run', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);

  try {
    const result = await runSyncJob(req.params.id, req.user.id, ({ msg, level }) => {
      send('log', { text: msg, level });
    });
    send('done', result);
    res.end();
  } catch (err) {
    send('error', { text: err.message });
    res.end();
  }
});

// GET /api/sync/jobs/:id/runs — history
router.get('/jobs/:id/runs', (req, res) => {
  const runs = db.prepare('SELECT id, started_at, finished_at, status, records_in, records_out, dupes_found, errors FROM sync_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 20').all(req.params.id);
  res.json({ runs });
});

// POST /api/sync/preview-dupes — local dedup preview before running
router.post('/preview-dupes', async (req, res) => {
  const { connectionId, module, rules } = req.body;
  if (!connectionId) return res.status(400).json({ error: 'connectionId required' });

  try {
    const connector = getConnector(connectionId, req.user.id);
    const { records } = await connector.getRecords(module || 'contacts', { pageSize: 200 });
    const dupes = findLocalDuplicates(records, rules || {});
    res.json({ total: records.length, duplicates: dupes.length, pairs: dupes.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
