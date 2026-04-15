'use strict';

/**
 * SeedMind Orchestrator — Netlify Serverless Function
 * Route: POST /ask
 *
 * Pipeline:
 *   1. Load growth ring from memory engine
 *   2. Build system prompt (base + ring context)
 *   3. Call LLM -> get structured JSON (ideas, twist, question, signals)
 *   4. Extract + validate signals
 *   5. Update growth ring via updateGrowthRings
 *   6. Persist updated ring to memory engine (fire-and-forget)
 *   7. Format and return the brainstorm to the client
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { SYSTEM_PROMPT, ringToPromptContext, createGrowthRing } = require('@seedmind/shared');
const { extractSignals }    = require('../../apps/orchestrator/extractSignals');
const { updateGrowthRings } = require('../../apps/orchestrator/updateGrowthRings');

// --- Environment ---
const MEMORY_URL = Netlify.env.get('MEMORY_URL');
const LLM_URL    = Netlify.env.get('LLM_URL') || 'https://api.openai.com/v1/chat/completions';
const LLM_KEY    = Netlify.env.get('LLM_KEY');
const LLM_MODEL  = Netlify.env.get('LLM_MODEL') || 'gpt-4o-mini';

if (!LLM_KEY) {
  console.warn('[orchestrator] WARNING: LLM_KEY env var is not set.');
}

// --- HTTP helpers ---

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json();
}

// --- Memory helpers ---

async function loadRing(userId) {
  if (!MEMORY_URL) return createGrowthRing(userId);
  try {
    return await fetchJson(`${MEMORY_URL}/${encodeURIComponent(userId)}`);
  } catch (err) {
    console.warn('[orchestrator] Could not load ring, using default:', err.message);
    return createGrowthRing(userId);
  }
}

async function saveRing(userId, signals) {
  if (!MEMORY_URL) return;
  try {
    await fetchJson(`${MEMORY_URL}/${encodeURIComponent(userId)}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(signals),
    });
  } catch (err) {
    console.warn('[orchestrator] Could not save ring:', err.message);
  }
}

// --- LLM call ---

async function callLLM(systemPrompt, userMessage) {
  const data = await fetchJson(LLM_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${LLM_KEY}`,
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

// --- Response formatter ---

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

// --- Handler ---

export default async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const { userId, message } = body || {};

  if (!userId || typeof userId !== 'string' || userId.length > 128) {
    return Response.json({ error: 'Invalid or missing userId' }, { status: 400, headers: corsHeaders });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ error: 'Invalid or missing message' }, { status: 400, headers: corsHeaders });
  }
  if (message.length > 4000) {
    return Response.json({ error: 'Message too long (max 4000 chars)' }, { status: 400, headers: corsHeaders });
  }

  try {
    // 1. Load growth ring
    const ring = await loadRing(userId);

    // 2. Build system prompt with ring context
    const ringContext  = ringToPromptContext(ring);
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${ringContext}`;

    // 3. Call LLM
    const rawLLMText = await callLLM(systemPrompt, message.trim());

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
    return Response.json({
      response: formatBrainstorm(payload),
      version:  ring.meta.total_interactions,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('[orchestrator] Error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
};

export const config = {
  path: '/ask',
  method: ['POST', 'OPTIONS'],
};
