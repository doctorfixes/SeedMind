'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  createGrowthRing,
  mergeRingUpdate,
  ringToPromptContext,
  DECAY,
  MIN_INCREMENT,
  MAX_INCREMENT,
  CLAMP_MIN,
  CLAMP_MAX,
} = require('../index.js');

// ─── createGrowthRing edge cases ─────────────────────────────────────────────

describe('createGrowthRing — edge cases', () => {
  it('accepts an empty-string userId', () => {
    const ring = createGrowthRing('');
    assert.equal(ring.userId, '');
  });

  it('preserves special characters in userId', () => {
    const ring = createGrowthRing('u_abc-123');
    assert.equal(ring.userId, 'u_abc-123');
  });

  it('includes meta.version from the schema', () => {
    const ring = createGrowthRing('u');
    assert.equal(ring.meta.version, '1.0');
  });

  it('has all expected keys in thinking_style', () => {
    const ring = createGrowthRing('u');
    const keys = Object.keys(ring.thinking_style).sort();
    assert.deepEqual(keys, ['analytical', 'creative', 'exploratory', 'structured']);
  });

  it('has all expected keys in domains', () => {
    const ring = createGrowthRing('u');
    const keys = Object.keys(ring.domains).sort();
    assert.deepEqual(keys, ['art', 'business', 'design', 'music', 'other', 'science', 'tech', 'writing']);
  });

  it('has all expected keys in output_shapes', () => {
    const ring = createGrowthRing('u');
    const keys = Object.keys(ring.output_shapes).sort();
    assert.deepEqual(keys, ['brief', 'detailed', 'listy', 'narrative', 'visual']);
  });
});

// ─── mergeRingUpdate — extended scenarios ─────────────────────────────────────

describe('mergeRingUpdate — multiple sequential updates', () => {
  it('accumulates interactions across multiple merges', () => {
    const ring = createGrowthRing('u');
    mergeRingUpdate(ring, {});
    mergeRingUpdate(ring, {});
    mergeRingUpdate(ring, {});
    assert.equal(ring.meta.total_interactions, 3);
  });

  it('decays a signal towards zero over many empty updates', () => {
    const ring = createGrowthRing('u');
    ring.thinking_style.analytical = 1.0;
    for (let i = 0; i < 50; i++) {
      mergeRingUpdate(ring, {});
    }
    // 1.0 * 0.98^50 ≈ 0.364
    assert.ok(ring.thinking_style.analytical < 0.4);
    assert.ok(ring.thinking_style.analytical > 0.3);
  });

  it('never exceeds CLAMP_MAX even with repeated positive increments', () => {
    const ring = createGrowthRing('u');
    for (let i = 0; i < 100; i++) {
      mergeRingUpdate(ring, { thinking_style: { analytical: MAX_INCREMENT } });
    }
    assert.ok(ring.thinking_style.analytical <= CLAMP_MAX);
  });

  it('never goes below CLAMP_MIN even with repeated negative increments', () => {
    const ring = createGrowthRing('u');
    for (let i = 0; i < 100; i++) {
      mergeRingUpdate(ring, { thinking_style: { analytical: -MAX_INCREMENT } });
    }
    assert.ok(ring.thinking_style.analytical >= CLAMP_MIN);
  });
});

describe('mergeRingUpdate — multi-group simultaneous update', () => {
  it('applies increments to all three groups in one call', () => {
    const ring = createGrowthRing('u');
    mergeRingUpdate(ring, {
      thinking_style: { creative: 0.1 },
      domains:        { science: 0.1 },
      output_shapes:  { visual: 0.1 },
    });
    assert.ok(Math.abs(ring.thinking_style.creative - 0.1) < 1e-9);
    assert.ok(Math.abs(ring.domains.science - 0.1) < 1e-9);
    assert.ok(Math.abs(ring.output_shapes.visual - 0.1) < 1e-9);
  });

  it('ignores non-number increment values', () => {
    const ring = createGrowthRing('u');
    mergeRingUpdate(ring, { thinking_style: { analytical: 'bad' } });
    // analytical should still be decayed 0 (= 0)
    assert.equal(ring.thinking_style.analytical, 0);
  });
});

// ─── ringToPromptContext — extended scenarios ─────────────────────────────────

describe('ringToPromptContext — edge cases', () => {
  it('includes all three groups when all have non-trivial values', () => {
    const ring = createGrowthRing('u');
    ring.thinking_style.analytical = 0.8;
    ring.domains.tech = 0.6;
    ring.output_shapes.listy = 0.5;
    const ctx = ringToPromptContext(ring);
    assert.ok(ctx.includes('thinking_style:'));
    assert.ok(ctx.includes('domains:'));
    assert.ok(ctx.includes('output_shapes:'));
  });

  it('limits to top 4 signals per group', () => {
    const ring = createGrowthRing('u');
    // Set all thinking_style signals to non-trivial values
    ring.thinking_style.analytical = 0.8;
    ring.thinking_style.creative = 0.7;
    ring.thinking_style.structured = 0.6;
    ring.thinking_style.exploratory = 0.5;
    const ctx = ringToPromptContext(ring);
    // All 4 should be included (the cap is 4)
    assert.ok(ctx.includes('analytical'));
    assert.ok(ctx.includes('creative'));
    assert.ok(ctx.includes('structured'));
    assert.ok(ctx.includes('exploratory'));
  });

  it('sorts signals by absolute value descending', () => {
    const ring = createGrowthRing('u');
    ring.thinking_style.analytical = 0.1;
    ring.thinking_style.creative = 0.9;
    const ctx = ringToPromptContext(ring);
    const tsLine = ctx.split('\n').find((l) => l.includes('thinking_style:'));
    const creativeIdx = tsLine.indexOf('creative');
    const analyticalIdx = tsLine.indexOf('analytical');
    assert.ok(creativeIdx < analyticalIdx, 'creative should come before analytical');
  });

  it('includes negative values if their absolute value >= 0.05', () => {
    const ring = createGrowthRing('u');
    ring.thinking_style.analytical = -0.5;
    const ctx = ringToPromptContext(ring);
    assert.ok(ctx.includes('analytical'));
    assert.ok(ctx.includes('-0.50'));
  });

  it('handles a ring with null meta gracefully', () => {
    const ring = createGrowthRing('u');
    ring.meta = null;
    // ringToPromptContext uses optional chaining: ring?.meta?.total_interactions ?? 0
    const ctx = ringToPromptContext(ring);
    assert.ok(ctx.includes('0 interactions'));
  });

  it('handles a ring with missing groups gracefully', () => {
    const ring = createGrowthRing('u');
    delete ring.thinking_style;
    // Should not throw
    assert.doesNotThrow(() => ringToPromptContext(ring));
  });
});

// ─── Constants sanity ────────────────────────────────────────────────────────

describe('constants — additional checks', () => {
  it('DECAY is exactly 0.98', () => {
    assert.equal(DECAY, 0.98);
  });

  it('MIN_INCREMENT is 0.05', () => {
    assert.equal(MIN_INCREMENT, 0.05);
  });

  it('MAX_INCREMENT is 0.15', () => {
    assert.equal(MAX_INCREMENT, 0.15);
  });
});
