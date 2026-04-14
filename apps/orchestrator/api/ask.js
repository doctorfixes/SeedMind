'use strict';

/**
 * SeedMind Orchestrator — Vercel Serverless Function
 * Route: POST /ask
 *
 * Pipeline:
 *   1. Load growth ring from memory engine
 *   2. Build system prompt (base + ring context)
 *   3. Call LLM
 *   4. Extract preference signals from the exchange
 *   5. Update growth ring in memory engine
 *   6. Return brainstorm response to client
 */

const {
  SYSTEM_PROMPT,
  ringToPromptContext,
  extractSignals,
  createGrowthRing,
} = require('@seedmind/shared');

// ─── Environment ──────────────────────────────────────────────────────────────
const MEMORY_URL = process.env.MEMORY_URL;
const LLM_URL    = process.env.LLM_URL || 'https://api.openai.com/v1/chat/completions';
const LLM_KEY    = process.env.LLM_KEY;
const LLM_MODEL  = process.env.LLM_MODEL || 'gpt-4o-mini';

if (!LLM_KEY) {
  console.warn('[orchestrator] WARNING: LLM_KEY env var is not set.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson(url, options) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json();
}

async function loadRing(userId) {
  if (!MEMORY_URL) return createGrowthRing(userId);
  try {
    return await fetchJson(`${MEMORY_URL}/${encodeURIComponent(userId)}`);
  } catch (err) {
    console.warn('[orchestrator] Could not load ring, using default:', err.message);
    return createGrowthRing(userId);
  }
}

async function saveRing(userId, update) {
  if (!MEMORY_URL) return;
  try {
    await fetchJson(`${MEMORY_URL}/${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
  } catch (err) {
    console.warn('[orchestrator] Could not save ring:', err.message);
  }
}

async function callLLM(systemPrompt, userMessage) {
  const body = {
    model: LLM_MODEL,
    messages: [
      { role: 'system',    content: systemPrompt },
      { role: 'user',      content: userMessage  },
    ],
    temperature: 0.8,
    max_tokens: 1024,
  };

  const data = await fetchJson(LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify(body),
  });

  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS — allow the Vercel-hosted client
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, message } = req.body || {};

  if (!userId || typeof userId !== 'string' || userId.length > 128) {
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'Message too long (max 4000 chars)' });
  }

  try {
    // 1. Load growth ring
    const ring = await loadRing(userId);

    // 2. Build system prompt
    const ringContext = ringToPromptContext(ring);
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${ringContext}`;

    // 3. Call LLM
    const llmResponse = await callLLM(systemPrompt, message.trim());

    // 4. Extract signals
    const signals = extractSignals(message.trim(), llmResponse);

    // 5. Persist updated ring (fire-and-forget — don't block the response)
    saveRing(userId, signals);

    // 6. Respond
    return res.status(200).json({
      response: llmResponse,
      version:  (ring.version ?? 0) + 1,
    });
  } catch (err) {
    console.error('[orchestrator] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
