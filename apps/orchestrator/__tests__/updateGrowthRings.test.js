'use strict';

const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { updateGrowthRings } = require('../updateGrowthRings.js');
const { createGrowthRing } = require('../../../packages/shared');

// ─── updateGrowthRings ────────────────────────────────────────────────────────

describe('updateGrowthRings', () => {
  function freshRing() {
    return createGrowthRing('test-user');
  }

  it('returns the mutated ring', () => {
    const ring = freshRing();
    const result = updateGrowthRings(ring, {});
    assert.strictEqual(result, ring);
  });

  it('increments total_interactions by 1', () => {
    const ring = freshRing();
    updateGrowthRings(ring, {});
    assert.equal(ring.meta.total_interactions, 1);
  });

  it('applies a thinking_style signal increment', () => {
    const ring = freshRing();
    updateGrowthRings(ring, { thinking_style: { analytical: 0.1 } });
    assert.ok(Math.abs(ring.thinking_style.analytical - 0.1) < 1e-9);
  });

  it('applies a domains signal increment', () => {
    const ring = freshRing();
    updateGrowthRings(ring, { domains: { tech: 0.1 } });
    assert.ok(Math.abs(ring.domains.tech - 0.1) < 1e-9);
  });

  it('applies an output_shapes signal increment', () => {
    const ring = freshRing();
    updateGrowthRings(ring, { output_shapes: { listy: 0.1 } });
    assert.ok(Math.abs(ring.output_shapes.listy - 0.1) < 1e-9);
  });

  it('decays existing values before applying increments', () => {
    const ring = freshRing();
    ring.thinking_style.creative = 1.0;
    updateGrowthRings(ring, { thinking_style: { creative: 0.0 } });
    // value should be 1.0 * 0.98 = 0.98 (0 increment doesn't exist in signals)
    // When we pass {creative: 0.0}, the shared module still applies decay but
    // then adds 0.  Result should be < 1.0.
    assert.ok(ring.thinking_style.creative < 1.0);
  });

  it('handles empty signals without throwing', () => {
    const ring = freshRing();
    assert.doesNotThrow(() => updateGrowthRings(ring, {}));
  });

  it('handles null signals without throwing', () => {
    const ring = freshRing();
    assert.doesNotThrow(() => updateGrowthRings(ring, null));
  });

  it('sets meta.last_updated to a valid ISO date string', () => {
    const ring = freshRing();
    updateGrowthRings(ring, {});
    assert.ok(typeof ring.meta.last_updated === 'string');
    assert.ok(!isNaN(Date.parse(ring.meta.last_updated)));
  });
});
