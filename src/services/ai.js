// src/services/ai.js
// Powers the AI doc-reading engine using Claude via the Anthropic SDK
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Analyse API documentation URL ─────────────────────────────────────────────
// Returns: { platform_name, auth, modules[], summary }
async function analyseApiDocs(docsUrl) {
  const systemPrompt = `You are an API integration specialist. The user will give you a URL to API documentation.
Your job is to read the documentation and extract structured information about the API.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.

Return this exact shape:
{
  "platform_name": "string — name of the platform",
  "platform_type": "string — CRM | Helpdesk | Marketing | Database | Project Management | Other",
  "base_url": "string — base URL for API calls",
  "auth": {
    "type": "api_key | oauth2 | basic | bearer",
    "details": {
      "header_name": "string (if api_key or bearer)",
      "header_format": "string e.g. 'Token {key}' or 'Bearer {token}'",
      "oauth_authorize_url": "string (if oauth2)",
      "oauth_token_url": "string (if oauth2)",
      "scopes": ["string"] 
    },
    "instructions": "string — plain English instructions for the user to obtain credentials"
  },
  "modules": [
    {
      "name": "string — module name e.g. Contacts",
      "endpoint": "string — primary list endpoint e.g. /contacts",
      "description": "string — one sentence",
      "estimated_count": null,
      "fields": [
        {
          "name": "string — field key",
          "type": "string | integer | decimal | boolean | datetime | enum | object | array",
          "description": "string",
          "required": true
        }
      ]
    }
  ],
  "pagination": {
    "type": "page | cursor | offset | none",
    "param": "string — query param name if applicable"
  },
  "rate_limit": "string — e.g. '1000 req/hr' or 'unknown'",
  "notes": "string — any important notes for the user"
}

Be thorough — extract ALL modules and their fields from the docs. If the docs are large, include at least the 6 most important modules.`;

  // Use web_search tool so Claude can actually fetch the docs URL
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: systemPrompt,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Please read the API documentation at this URL and return the structured JSON: ${docsUrl}`,
      },
    ],
  });

  // Extract text content from the response (may have tool_use blocks too)
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text response from AI');

  try {
    const clean = textBlock.text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    throw new Error('AI returned invalid JSON — try a different docs URL');
  }
}

// ── Suggest field mappings between two sets of fields ─────────────────────────
async function suggestFieldMappings(sourceFields, destFields, sourcePlatform, destPlatform) {
  const prompt = `You are a CRM data integration expert.

Map fields from ${sourcePlatform} to ${destPlatform}.

Source fields: ${JSON.stringify(sourceFields)}
Destination fields: ${JSON.stringify(destFields)}

Respond with ONLY a JSON array — no markdown, no explanation:
[
  {
    "source_field": "string",
    "dest_field": "string or null if no match",
    "confidence": "high | medium | low",
    "notes": "string or null"
  }
]

Map every source field. Use null for dest_field if there is no reasonable match.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ── Detect likely duplicate records using AI ──────────────────────────────────
async function detectDuplicates(records, rules) {
  // For large datasets this would be chunked — this handles a sample for preview
  const prompt = `You are a data deduplication expert.

Dedup rules: ${JSON.stringify(rules)}

Given these records, identify likely duplicate pairs. 
Records: ${JSON.stringify(records.slice(0, 50))}

Respond with ONLY JSON — no markdown:
[
  {
    "record_a_id": "string",
    "record_b_id": "string", 
    "confidence": "high | medium | low",
    "matched_on": ["field1", "field2"],
    "suggested_master": "a | b",
    "reason": "string"
  }
]`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ── Generate a human-readable sync summary ────────────────────────────────────
async function generateSyncSummary(stats) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Write a 2-sentence plain-English summary of this CRM sync operation for the end user. Stats: ${JSON.stringify(stats)}`,
      },
    ],
  });
  return response.content[0].text;
}

module.exports = { analyseApiDocs, suggestFieldMappings, detectDuplicates, generateSyncSummary };
