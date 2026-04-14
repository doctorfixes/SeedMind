'use strict';

const { describe, it, before } = require('node:test');
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
  SYSTEM_PROMPT,
} = require('../index.js');

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('DECAY is between 0 and 1', () => {
    assert.ok(DECAY > 0 && DECAY < 1, `Expected DECAY in (0,1), got ${DECAY}`);
  });

  it('MIN_INCREMENT is positive and less than MAX_INCREMENT', () => {
    assert.ok(MIN_INCREMENT > 0);
    assert.ok(MIN_INCREMENT < MAX_INCREMENT);
  });

  it('CLAMP_MIN is -1 and CLAMP_MAX is 1', () => {
    assert.equal(CLAMP_MIN, -1);
    assert.equal(CLAMP_MAX, 1);
  });

  it('SYSTEM_PROMPT is a non-empty string', () => {
    assert.equal(typeof SYSTEM_PROMPT, 'string');
    assert.ok(SYSTEM_PROMPT.length > 0);
  });
});

// ─── createGrowthRing ────────────────────────────────────────────────────────

describe('createGrowthRing', () => {
  it('returns an object with the provided userId', () => {
    const ring = createGrowthRing('user-123');
    assert.equal(ring.userId, 'user-123');
  });

  it('includes thinking_style, domains, and output_shapes groups', () => {
    const ring = createGrowthRing('u1');
    assert.ok(ring.thinking_style);
    assert.ok(ring.domains);
    assert.ok(ring.output_shapes);
  });

  it('initialises all signal values to 0', () => {
    const ring = createGrowthRing('u2');
    for (const group of ['thinking_style', 'domains', 'output_shapes']) {
      for (const val of Object.values(ring[group])) {
        assert.equal(val, 0);
      }
    }
  });

  it('initialises meta.total_interactions to 0', () => {
    const ring = createGrowthRing('u3');
    assert.equal(ring.meta.total_interactions, 0);
  });

  it('initialises meta.last_updated to null', () => {
    const ring = createGrowthRing('u4');
    assert.equal(ring.meta.last_updated, null);
  });

  it('creates independent objects each call (no shared reference)', () => {
    const a = createGrowthRing('a');
    const b = createGrowthRing('b');
    a.thinking_style.analytical = 0.5;
    assert.equal(b.thinking_style.analytical, 0);
  });
});

// ─── mergeRingUpdate ─────────────────────────────────────────────────────────

describe('mergeRingUpdate', () => {
  function freshRing() {
    return createGrowthRing('test-user');
  }

  it('increments total_interactions by 1', () => {
    const ring = freshRing();
    mergeRingUpdate(ring, {});
    assert.equal(ring.meta.total_interactions, 1);
  });

  it('increments total_interactions on each call', () => {
    const ring = freshRing();
    mergeRingUpdate(ring, {});
    mergeRingUpdate(ring, {});
    assert.equal(ring.meta.total_interactions, 2);
  });

  it('sets last_updated to an ISO string', () => {
    const ring = freshRing();
    mergeRingUpdate(ring, {});
    assert.ok(typeof ring.meta.last_updated === 'string');
    assert.ok(!isNaN(Date.parse(ring.meta.last_updated)));
  });

  it('decays existing signal values', () => {
    const ring = freshRing();
    ring.thinking_style.analytical = 1.0;
    mergeRingUpdate(ring, {});
    assert.ok(
      Math.abs(ring.thinking_style.analytical - DECAY) < 1e-9,
      `Expected ~${DECAY}, got ${ring.thinking_style.analytical}`,
    );
  });

  it('applies positive increment to a signal', () => {
    const ring = freshRing();
    mergeRingUpdate(ring, { thinking_style: { analytical: 0.1 } });
    // 0 * DECAY + 0.1 = 0.1
    assert.ok(Math.abs(ring.thinking_style.analytical - 0.1) < 1e-9);
  });

  it('applies negative increment to a signal', () => {
    const ring = freshRing();
    mergeRingUpdate(ring, { thinking_style: { creative: -0.1 } });
    assert.ok(Math.abs(ring.thinking_style.creative - (-0.1)) < 1e-9);
  });

  it('clamps signal at CLAMP_MAX (1)', () => {
    const ring = freshRing();
    ring.thinking_style.analytical = 1.0;
    mergeRingUpdate(ring, { thinking_style: { analytical: 0.15 } });
    assert.ok(ring.thinking_style.analytical <= CLAMP_MAX);
  });

  it('clamps signal at CLAMP_MIN (-1)', () => {
    const ring = freshRing();
    ring.thinking_style.analytical = -1.0;
    mergeRingUpdate(ring, { thinking_style: { analytical: -0.15 } });
    assert.ok(ring.thinking_style.analytical >= CLAMP_MIN);
  });

  it('ignores unknown signal keys', () => {
    const ring = freshRing();
    mergeRingUpdate(ring, { thinking_style: { unknown_key: 0.5 } });
    assert.equal(ring.thinking_style.unknown_key, undefined);
  });

  it('handles missing signals gracefully', () => {
    const ring = freshRing();
    assert.doesNotThrow(() => mergeRingUpdate(ring, {}));
    assert.doesNotThrow(() => mergeRingUpdate(ring, null));
    assert.doesNotThrow(() => mergeRingUpdate(ring, undefined));
  });

  it('applies increments across domains and output_shapes groups', () => {
    const ring = freshRing();
    mergeRingUpdate(ring, {
      domains:       { tech: 0.1 },
      output_shapes: { listy: 0.1 },
    });
    assert.ok(Math.abs(ring.domains.tech - 0.1) < 1e-9);
    assert.ok(Math.abs(ring.output_shapes.listy - 0.1) < 1e-9);
  });

  it('returns the mutated ring', () => {
    const ring = freshRing();
    const result = mergeRingUpdate(ring, {});
    assert.strictEqual(result, ring);
  });
});

// ─── ringToPromptContext ──────────────────────────────────────────────────────

describe('ringToPromptContext', () => {
  function freshRing(userId = 'u') {
    return createGrowthRing(userId);
  }

  it('returns a string', () => {
    assert.equal(typeof ringToPromptContext(freshRing()), 'string');
  });

  it('includes interaction count', () => {
    const ring = freshRing();
    ring.meta.total_interactions = 7;
    const ctx = ringToPromptContext(ring);
    assert.ok(ctx.includes('7'), `Expected "7" in: ${ctx}`);
  });

  it('omits groups with all-zero values', () => {
    const ctx = ringToPromptContext(freshRing());
    assert.ok(!ctx.includes('thinking_style:'));
    assert.ok(!ctx.includes('domains:'));
    assert.ok(!ctx.includes('output_shapes:'));
  });

  it('includes top signal keys when values are non-trivial', () => {
    const ring = freshRing();
    ring.thinking_style.analytical = 0.8;
    ring.domains.tech = 0.6;
    const ctx = ringToPromptContext(ring);
    assert.ok(ctx.includes('analytical'), `Expected "analytical" in: ${ctx}`);
    assert.ok(ctx.includes('tech'), `Expected "tech" in: ${ctx}`);
  });

  it('excludes signals below the 0.05 threshold', () => {
    const ring = freshRing();
    ring.thinking_style.analytical = 0.04;
    const ctx = ringToPromptContext(ring);
    assert.ok(!ctx.includes('analytical'), `Expected no "analytical" in: ${ctx}`);
  });

  it('returns a string starting with the context header', () => {
    const ring = freshRing();
    const ctx = ringToPromptContext(ring);
    assert.ok(ctx.startsWith('Growth-ring context'));
  });
});
