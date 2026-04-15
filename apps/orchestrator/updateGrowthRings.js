'use strict';

/**
 * updateGrowthRings.js
 *
 * Applies a signal update to a growth ring using the canonical mechanics:
 *   1. Decay  — multiply every numeric signal by DECAY (0.98)
 *   2. Add    — apply the LLM-returned increments
 *   3. Clamp  — keep all values in [CLAMP_MIN, CLAMP_MAX]
 *   4. Meta   — increment total_interactions, update last_updated
 *
 * This is a thin orchestrator-side wrapper around mergeRingUpdate from
 * @seedmind/shared, provided as a named module for testability and clarity.
 */

const { mergeRingUpdate } = require('../../packages/shared');

/**
 * @param {import('@seedmind/types').GrowthRing}   ring
 * @param {import('@seedmind/types').SignalUpdate}  signals
 * @returns {import('@seedmind/types').GrowthRing}  The mutated ring.
 */
function updateGrowthRings(ring, signals) {
  return mergeRingUpdate(ring, signals);
}

module.exports = { updateGrowthRings };
