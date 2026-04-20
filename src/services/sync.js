// src/services/sync.js
// Core dedup + merge + sync engine
const { v4: uuid } = require('uuid');
const db = require('../db');
const { getConnector } = require('../connectors');
const { detectDuplicates, suggestFieldMappings, generateSyncSummary } = require('./ai');

// ── Fuzzy string similarity (Jaro-Winkler lite) ───────────────────────────────
function similarity(a = '', b = '') {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const editDist = levenshtein(longer, shorter);
  return (longer.length - editDist) / longer.length;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

// ── Local dedup (fast, no AI) ─────────────────────────────────────────────────
function findLocalDuplicates(records, rules = {}) {
  const {
    emailMatch = 'exact',
    nameMatch = 'fuzzy',
    nameSimilarityThreshold = 0.8,
    companyMatch = 'normalise',
  } = rules;

  const dupes = [];
  const seen = new Map();

  for (let i = 0; i < records.length; i++) {
    const a = records[i];
    const emailKey = emailMatch === 'domain'
      ? (a.email || a.Email || '').split('@')[1]
      : (a.email || a.Email || '').toLowerCase().trim();

    if (!emailKey) continue;

    if (seen.has(emailKey)) {
      const j = seen.get(emailKey);
      const b = records[j];

      // Check name similarity
      const aName = `${a.first_name || a.FirstName || ''} ${a.last_name || a.LastName || ''}`.trim();
      const bName = `${b.first_name || b.FirstName || ''} ${b.last_name || b.LastName || ''}`.trim();
      const nameSim = nameMatch === 'exact'
        ? (aName.toLowerCase() === bName.toLowerCase() ? 1 : 0)
        : similarity(aName, bName);

      if (nameSim >= (nameMatch === 'ignore' ? 0 : nameSimilarityThreshold)) {
        dupes.push({
          record_a_id: a._id,
          record_b_id: b._id,
          confidence: nameSim > 0.95 ? 'high' : 'medium',
          matched_on: ['email', ...(nameSim > 0.7 ? ['name'] : [])],
          suggested_master: chooseMaster(a, b, rules.mergeStrategy),
          reason: `Email match: ${emailKey}`,
        });
      }
    } else {
      seen.set(emailKey, i);
    }
  }

  return dupes;
}

function chooseMaster(a, b, strategy = 'most_complete') {
  if (strategy === 'newest') {
    const aDate = new Date(a.lastmodifieddate || a.LastModifiedDate || a.updated_at || 0);
    const bDate = new Date(b.lastmodifieddate || b.LastModifiedDate || b.updated_at || 0);
    return aDate >= bDate ? 'a' : 'b';
  }
  if (strategy === 'prefer_source_a') return 'a';
  // most_complete: count non-null fields
  const aCount = Object.values(a).filter(v => v != null && v !== '').length;
  const bCount = Object.values(b).filter(v => v != null && v !== '').length;
  return aCount >= bCount ? 'a' : 'b';
}

// ── Merge two records into one ────────────────────────────────────────────────
function mergeRecords(master, duplicate) {
  const merged = { ...duplicate, ...master }; // master wins on conflicts
  // Fill in any empty master fields from duplicate
  for (const [k, v] of Object.entries(duplicate)) {
    if (merged[k] == null || merged[k] === '') merged[k] = v;
  }
  return merged;
}

// ── Apply field mapping ───────────────────────────────────────────────────────
function applyFieldMap(record, fieldMap) {
  const result = {};
  for (const [srcField, destField] of Object.entries(fieldMap)) {
    if (destField && record[srcField] !== undefined) {
      result[destField] = record[srcField];
    }
  }
  return result;
}

// ── Main sync job runner ───────────────────────────────────────────────────────
async function runSyncJob(jobId, userId, onProgress) {
  const job = db.prepare('SELECT * FROM sync_jobs WHERE id = ? AND user_id = ?').get(jobId, userId);
  if (!job) throw new Error('Job not found');

  const runId = uuid();
  db.prepare(
    'INSERT INTO sync_runs (id, job_id, status) VALUES (?, ?, ?)'
  ).run(runId, jobId, 'running');
  db.prepare("UPDATE sync_jobs SET status = 'running' WHERE id = ?").run(jobId);

  const log = [];
  const progress = (msg, level = 'info') => {
    log.push({ ts: Date.now(), msg, level });
    if (onProgress) onProgress({ msg, level });
  };

  try {
    const fieldMap = JSON.parse(job.field_map || '{}');
    const dedupRules = JSON.parse(job.dedup_rules || '{}');

    progress('Connecting to source platform...');
    const sourceConn = getConnector(job.source_id, userId);

    progress('Connecting to destination platform...');
    const destConn = getConnector(job.destination_id, userId);

    progress('Fetching source modules...');
    const modules = await sourceConn.getModules();
    const targetModule = modules[0]?.key || 'contacts';

    progress(`Fetching all records from source (${targetModule})...`);
    const sourceRecords = await sourceConn.getAllRecords(targetModule);
    progress(`Fetched ${sourceRecords.length} records from source`, 'ok');

    // Dedup
    progress('Running duplicate detection...');
    const dupes = findLocalDuplicates(sourceRecords, dedupRules);
    progress(`Found ${dupes.length} duplicate pairs`, dupes.length > 0 ? 'warn' : 'ok');

    // Merge dupes
    const dupIds = new Set();
    const mergedRecords = [...sourceRecords];

    for (const dupe of dupes) {
      if (dupIds.has(dupe.record_a_id) || dupIds.has(dupe.record_b_id)) continue;
      const idxA = mergedRecords.findIndex(r => r._id === dupe.record_a_id);
      const idxB = mergedRecords.findIndex(r => r._id === dupe.record_b_id);
      if (idxA === -1 || idxB === -1) continue;
      const master = dupe.suggested_master === 'a' ? mergedRecords[idxA] : mergedRecords[idxB];
      const dup = dupe.suggested_master === 'a' ? mergedRecords[idxB] : mergedRecords[idxA];
      mergedRecords[idxA] = mergeRecords(master, dup);
      dupIds.add(dup._id);
    }

    const cleanRecords = mergedRecords.filter(r => !dupIds.has(r._id));
    progress(`Merged duplicates. ${cleanRecords.length} clean records ready to sync`, 'ok');

    // Apply field mapping + sync
    let synced = 0, errors = 0;
    progress('Writing to destination...');

    for (const record of cleanRecords) {
      try {
        const mapped = Object.keys(fieldMap).length ? applyFieldMap(record, fieldMap) : record;
        await destConn.upsertRecord(targetModule, mapped);
        synced++;
        if (synced % 50 === 0) progress(`Synced ${synced}/${cleanRecords.length}...`);
        await new Promise(r => setTimeout(r, 50)); // rate limit
      } catch (err) {
        errors++;
        log.push({ ts: Date.now(), msg: `Error on record ${record._id}: ${err.message}`, level: 'error' });
      }
    }

    const stats = {
      total: sourceRecords.length,
      merged: dupes.length,
      synced,
      errors,
    };

    progress(`Sync complete: ${synced} records synced, ${dupes.length} merged, ${errors} errors`, 'ok');

    db.prepare('UPDATE sync_runs SET status = ?, finished_at = unixepoch(), records_in = ?, records_out = ?, dupes_found = ?, errors = ?, log = ? WHERE id = ?')
      .run('done', sourceRecords.length, synced, dupes.length, errors, JSON.stringify(log), runId);
    db.prepare('UPDATE sync_jobs SET status = ?, last_run = unixepoch(), stats = ? WHERE id = ?')
      .run('idle', JSON.stringify(stats), jobId);

    return { ok: true, stats, runId };
  } catch (err) {
    db.prepare('UPDATE sync_runs SET status = ?, finished_at = unixepoch(), log = ? WHERE id = ?')
      .run('error', JSON.stringify(log), runId);
    db.prepare("UPDATE sync_jobs SET status = 'error' WHERE id = ?").run(jobId);
    throw err;
  }
}

module.exports = { runSyncJob, findLocalDuplicates, mergeRecords, applyFieldMap };
