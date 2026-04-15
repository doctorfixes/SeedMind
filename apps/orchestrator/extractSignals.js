'use strict';

/**
 * extractSignals.js
 *
 * Parses the raw LLM response string into a structured LLMPayload.
 * The LLM is instructed to return raw JSON matching:
 *
 *   { ideas, twist, question, signals }
 *
 * This module handles parsing, validation, and graceful fallback so the
 * orchestrator never crashes due to a malformed LLM response.
 */

const { MIN_INCREMENT, MAX_INCREMENT } = require('../../packages/shared');

const VALID_GROUPS = ['thinking_style', 'domains', 'output_shapes'];
const VALID_KEYS = {
  thinking_style: new Set(['analytical', 'creative', 'structured', 'exploratory']),
  domains:        new Set(['tech', 'science', 'art', 'business', 'writing', 'design', 'music', 'other']),
  output_shapes:  new Set(['brief', 'detailed', 'visual', 'narrative', 'listy']),
};

/**
 * Clamps a signal increment: keeps it within the allowed range and preserves sign.
 * @param {number} value
 * @returns {number}
 */
function sanitizeIncrement(value) {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  const sign = value >= 0 ? 1 : -1;
  const abs  = Math.min(MAX_INCREMENT, Math.max(MIN_INCREMENT, Math.abs(value)));
  return sign * abs;
}

/**
 * Parses and validates the structured payload returned by the LLM.
 *
 * @param {string} rawText  The raw text from the LLM.
 * @returns {{ payload: import('@seedmind/types').LLMPayload, parseError: string|null }}
 */
function extractSignals(rawText) {
  // Strip accidental markdown fences just in case.
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/,           '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { payload: fallbackPayload(rawText), parseError: err.message };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { payload: fallbackPayload(rawText), parseError: 'LLM returned non-object JSON' };
  }

  // ── ideas ──────────────────────────────────────────────────────────────────
  const ideas = Array.isArray(parsed.ideas)
    ? parsed.ideas.filter((i) => typeof i === 'string').slice(0, 7)
    : [];
  while (ideas.length < 5) ideas.push('(idea not provided)');

  // ── twist & question ───────────────────────────────────────────────────────
  const twist    = typeof parsed.twist    === 'string' ? parsed.twist    : '';
  const question = typeof parsed.question === 'string' ? parsed.question : '';

  // ── signals ────────────────────────────────────────────────────────────────
  const rawSignals = parsed.signals ?? {};
  const signals    = {};

  for (const group of VALID_GROUPS) {
    const incoming = rawSignals[group];
    if (!incoming || typeof incoming !== 'object') continue;
    const cleaned = {};
    for (const [key, val] of Object.entries(incoming)) {
      if (!VALID_KEYS[group].has(key)) continue;
      const sanitised = sanitizeIncrement(val);
      if (sanitised !== 0) cleaned[key] = sanitised;
    }
    if (Object.keys(cleaned).length) signals[group] = cleaned;
  }

  return {
    payload: { ideas, twist, question, signals },
    parseError: null,
  };
}

/**
 * Builds a fallback payload when JSON parsing fails.
 * Surfaces the raw text as the first idea so the user still gets a response.
 * @param {string} rawText
 * @returns {import('@seedmind/types').LLMPayload}
 */
function fallbackPayload(rawText) {
  return {
    ideas:    [rawText.slice(0, 500)],
    twist:    '',
    question: '',
    signals:  {},
  };
}

module.exports = { extractSignals };
