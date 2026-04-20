// src/routes/ai.js
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { analyseApiDocs, suggestFieldMappings, detectDuplicates } = require('../services/ai');

const router = express.Router();
router.use(requireAuth);

// POST /api/ai/analyse-docs
// Body: { url: string }
// Returns: { platform_name, auth, modules[], ... }
router.post('/analyse-docs', async (req, res) => {
  const schema = z.object({ url: z.string().url() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid URL' });

  try {
    const result = await analyseApiDocs(parsed.data.url);
    res.json(result);
  } catch (err) {
    console.error('AI analysis error:', err);
    res.status(500).json({ error: err.message || 'AI analysis failed' });
  }
});

// POST /api/ai/suggest-mappings
// Body: { sourceFields, destFields, sourcePlatform, destPlatform }
router.post('/suggest-mappings', async (req, res) => {
  const { sourceFields, destFields, sourcePlatform, destPlatform } = req.body;
  if (!sourceFields || !destFields) {
    return res.status(400).json({ error: 'sourceFields and destFields required' });
  }

  try {
    const mappings = await suggestFieldMappings(
      sourceFields, destFields, sourcePlatform || 'Source', destPlatform || 'Destination'
    );
    res.json({ mappings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/detect-duplicates
// Body: { records[], rules }
router.post('/detect-duplicates', async (req, res) => {
  const { records, rules } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records must be an array' });

  try {
    const dupes = await detectDuplicates(records, rules || {});
    res.json({ duplicates: dupes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/analyse-docs/stream
// Server-sent events stream so the frontend shows a live log
router.post('/analyse-docs/stream', async (req, res) => {
  const schema = z.object({ url: z.string().url() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid URL' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, data) =>
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);

  try {
    send('log', { text: 'Fetching documentation page...', level: 'info' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    send('log', { text: 'AI reading and parsing docs...', level: 'info' });

    // Use streaming so we forward progress tokens to the SSE client
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are an API integration specialist. Analyse the API documentation at the given URL.
First write a brief progress commentary (3-5 lines starting with "LOG:") describing what you find.
Then output the complete JSON result on a new line starting with "RESULT:".
The JSON must match this shape exactly:
{"platform_name":"...","platform_type":"...","base_url":"...","auth":{"type":"api_key|oauth2|basic|bearer","details":{},"instructions":"..."},"modules":[{"name":"...","endpoint":"...","description":"...","fields":[{"name":"...","type":"...","required":true}]}],"pagination":{"type":"...","param":"..."},"rate_limit":"...","notes":"..."}`,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `Analyse this API docs URL: ${parsed.data.url}` }],
    });

    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        fullText += chunk.delta.text;
        // Stream LOG lines as they appear
        const lines = fullText.split('\n');
        for (const line of lines) {
          if (line.startsWith('LOG:')) {
            send('log', { text: line.replace('LOG:', '').trim(), level: 'ok' });
          }
        }
      }
    }

    // Extract RESULT JSON
    const resultMatch = fullText.match(/RESULT:\s*(\{[\s\S]+\})/);
    if (!resultMatch) {
      // Fall back: try to parse entire text as JSON
      try {
        const clean = fullText.replace(/```json|```|LOG:[^\n]*/g, '').trim();
        const result = JSON.parse(clean);
        send('result', { data: result });
      } catch {
        send('error', { text: 'Could not parse API structure from docs' });
      }
    } else {
      try {
        const result = JSON.parse(resultMatch[1]);
        send('log', { text: `Found ${result.modules?.length || 0} modules, auth: ${result.auth?.type}`, level: 'ok' });
        send('result', { data: result });
      } catch {
        send('error', { text: 'Invalid JSON in AI response' });
      }
    }

    res.end();
  } catch (err) {
    send('error', { text: err.message || 'Analysis failed' });
    res.end();
  }
});

module.exports = router;
