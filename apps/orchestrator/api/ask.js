'use strict';

/**
 * SeedMind Orchestrator — Netlify Serverless Function
 * Route: POST /ask
 *
 * Pipeline:
 *   1. Load growth ring from memory engine
 *   2. Build system prompt (base + ring context)
 *   3. Call LLM → get structured JSON (ideas, twist, question, signals)
 *   4. Extract + validate signals
 *   5. Update growth ring via updateGrowthRings
 *   6. Persist updated ring to memory engine (fire-and-forget)
 *   7. Format and return the brainstorm to the client
 */

const { SYSTEM_PROMPT, ringToPromptContext, createGrowthRing } = require('../../../packages/shared');
const { extractSignals }    = require('../extractSignals');
const { updateGrowthRings } = require('../updateGrowthRings');

// ─── Environment ──────────────────────────────────────────────────────────────
const MEMORY_URL = process.env.MEMORY_URL;
const LLM_URL    = process.env.LLM_URL || 'https://api.openai.com/v1/chat/completions';
const LLM_KEY    = process.env.LLM_KEY;
const LLM_MODEL  = process.env.LLM_MODEL || 'gpt-4o-mini';

if (!LLM_KEY) {
  console.warn('[orchestrator] WARNING: LLM_KEY env var is not set.');
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchJson(url, options) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json();
}

// ─── Memory helpers ───────────────────────────────────────────────────────────

async function loadRing(userId) {
  if (!MEMORY_URL) return createGrowthRing(userId);
  try {
    return await fetchJson(`${MEMORY_URL}/api/memory/${encodeURIComponent(userId)}`);
  } catch (err) {
    console.warn('[orchestrator] Could not load ring, using default:', err.message);
    return createGrowthRing(userId);
  }
}

async function saveRing(userId, signals) {
  if (!MEMORY_URL) return;
  try {
    await fetchJson(`${MEMORY_URL}/api/memory/${encodeURIComponent(userId)}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(signals),
    });
  } catch (err) {
    console.warn('[orchestrator] Could not save ring:', err.message);
  }
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function callLLM(systemPrompt, userMessage, llmKey) {
  const data = await fetchJson(LLM_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${llmKey}`,
    },
    body: JSON.stringify({
      model:       LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      temperature: 0.8,
      max_tokens:  1024,
    }),
  });

  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Response formatter ───────────────────────────────────────────────────────

/**
 * Formats the structured LLM payload into a readable brainstorm string.
 * @param {import('@seedmind/types').LLMPayload} payload
 * @returns {string}
 */
function formatBrainstorm(payload) {
  const lines = [];

  lines.push('💡 Ideas\n');
  payload.ideas.forEach((idea, i) => {
    lines.push(`${i + 1}. ${idea}`);
  });

  if (payload.twist) {
    lines.push('');
    lines.push(`🌀 Twist\n${payload.twist}`);
  }

  if (payload.question) {
    lines.push('');
    lines.push(`❓ ${payload.question}`);
  }

  return lines.join('\n');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

const handler = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { userId, message, llmKey: clientLlmKey } = req.body || {};

  if (!userId || typeof userId !== 'string' || userId.length > 128) {
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'Message too long (max 4000 chars)' });
  }
  if (clientLlmKey !== undefined && (typeof clientLlmKey !== 'string' || clientLlmKey.length > 256)) {
    return res.status(400).json({ error: 'Invalid llmKey' });
  }

  // Prefer client-supplied key (BYOK) over the server env var
  const effectiveLlmKey = (clientLlmKey && clientLlmKey.trim()) || LLM_KEY;
  if (!effectiveLlmKey) {
    return res.status(503).json({ error: 'No LLM API key configured. Please provide one in Settings.' });
  }

  try {
    // 1. Load growth ring
    const ring = await loadRing(userId);

    // 2. Build system prompt with ring context
    const ringContext  = ringToPromptContext(ring);
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${ringContext}`;

    // 3. Call LLM
    const rawLLMText = await callLLM(systemPrompt, message.trim(), effectiveLlmKey);

    // 4. Extract signals from structured response
    const { payload, parseError } = extractSignals(rawLLMText);
    if (parseError) {
      console.warn('[orchestrator] LLM parse error:', parseError);
    }

    // 5. Update growth ring
    updateGrowthRings(ring, payload.signals);

    // 6. Persist updated ring (fire-and-forget)
    saveRing(userId, payload.signals);

    // 7. Return formatted brainstorm
    return res.status(200).json({
      response: formatBrainstorm(payload),
      version:  ring.meta.total_interactions,
    });
  } catch (err) {
    console.error('[orchestrator] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = handler;
module.exports.formatBrainstorm = formatBrainstorm;
