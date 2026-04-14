'use strict';

/**
 * @seedmind/shared
 * Growth-ring schema, constants, and utilities shared by the orchestrator
 * and the memory engine.
 */

const schema    = require('./growthRingSchema.json');
const constants = require('./constants.js');

// ─── Growth-Ring Factory ──────────────────────────────────────────────────────

/**
 * Returns a fresh growth ring for a new user, cloned from the canonical schema.
 * @param {string} userId
 * @returns {import('@seedmind/types').GrowthRing}
 */
function createGrowthRing(userId) {
  return {
    userId,
    thinking_style: { ...schema.thinking_style },
    domains:        { ...schema.domains },
    output_shapes:  { ...schema.output_shapes },
    meta: {
      total_interactions: 0,
      last_updated: null,
      version: schema.meta.version,
    },
  };
}

// ─── Ring Update ─────────────────────────────────────────────────────────────

/**
 * Applies a partial signals update to a growth ring (mutates and returns it).
 * Each numeric group is decayed first, then the provided increments are added
 * and clamped to [CLAMP_MIN, CLAMP_MAX].
 *
 * @param {import('@seedmind/types').GrowthRing} ring
 * @param {{ thinking_style?: object, domains?: object, output_shapes?: object }} signals
 * @returns {import('@seedmind/types').GrowthRing}
 */
function mergeRingUpdate(ring, signals) {
  const { DECAY, CLAMP_MIN, CLAMP_MAX } = constants;
  const groups = ['thinking_style', 'domains', 'output_shapes'];

  for (const group of groups) {
    if (!ring[group]) continue;

    // Decay every existing signal.
    for (const key of Object.keys(ring[group])) {
      ring[group][key] = ring[group][key] * DECAY;
    }

    // Apply provided increments.
    const incoming = signals?.[group];
    if (incoming && typeof incoming === 'object') {
      for (const [key, increment] of Object.entries(incoming)) {
        if (typeof increment !== 'number') continue;
        if (!(key in ring[group])) continue; // ignore unknown keys
        ring[group][key] = Math.min(
          CLAMP_MAX,
          Math.max(CLAMP_MIN, ring[group][key] + increment),
        );
      }
    }
  }

  ring.meta.total_interactions += 1;
  ring.meta.last_updated = new Date().toISOString();

  return ring;
}

// ─── Prompt Context ───────────────────────────────────────────────────────────

/**
 * Serialises the top signals from a growth ring into a short context string
 * that can be appended to the LLM system prompt.
 *
 * @param {import('@seedmind/types').GrowthRing} ring
 * @returns {string}
 */
function ringToPromptContext(ring) {
  const interactions = ring?.meta?.total_interactions ?? 0;
  const lines = [`Growth-ring context (${interactions} interactions):`];

  const top = (group) =>
    Object.entries(ring[group] ?? {})
      .filter(([, v]) => Math.abs(v) >= 0.05)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 4)
      .map(([k, v]) => `${k}=${v.toFixed(2)}`)
      .join(', ');

  const ts = top('thinking_style');
  const d  = top('domains');
  const os = top('output_shapes');

  if (ts) lines.push(`thinking_style: ${ts}`);
  if (d)  lines.push(`domains: ${d}`);
  if (os) lines.push(`output_shapes: ${os}`);

  return lines.join('\n');
}

module.exports = {
  createGrowthRing,
  mergeRingUpdate,
  ringToPromptContext,
  ...constants,
};
