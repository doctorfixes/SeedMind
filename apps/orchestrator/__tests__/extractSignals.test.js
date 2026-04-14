'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { extractSignals } = require('../extractSignals.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validPayload(overrides = {}) {
  return JSON.stringify({
    ideas:    ['idea1', 'idea2', 'idea3', 'idea4', 'idea5'],
    twist:    'a twist',
    question: 'a question?',
    signals: {
      thinking_style: { analytical: 0.1 },
      domains:        { tech: 0.05 },
      output_shapes:  { listy: 0.1 },
    },
    ...overrides,
  });
}

// ─── Happy-path ───────────────────────────────────────────────────────────────

describe('extractSignals — happy path', () => {
  it('parses a well-formed JSON string without error', () => {
    const { parseError } = extractSignals(validPayload());
    assert.equal(parseError, null);
  });

  it('returns the correct ideas array', () => {
    const { payload } = extractSignals(validPayload());
    assert.equal(payload.ideas[0], 'idea1');
    assert.equal(payload.ideas.length, 5);
  });

  it('returns twist and question strings', () => {
    const { payload } = extractSignals(validPayload());
    assert.equal(payload.twist, 'a twist');
    assert.equal(payload.question, 'a question?');
  });

  it('returns validated signals', () => {
    const { payload } = extractSignals(validPayload());
    assert.ok(payload.signals.thinking_style?.analytical);
    assert.ok(payload.signals.domains?.tech);
    assert.ok(payload.signals.output_shapes?.listy);
  });
});

// ─── Markdown fence stripping ─────────────────────────────────────────────────

describe('extractSignals — markdown fence handling', () => {
  it('strips leading ```json fence', () => {
    const raw = '```json\n' + validPayload() + '\n```';
    const { parseError } = extractSignals(raw);
    assert.equal(parseError, null);
  });

  it('strips leading ``` fence without language tag', () => {
    const raw = '```\n' + validPayload() + '\n```';
    const { parseError } = extractSignals(raw);
    assert.equal(parseError, null);
  });
});

// ─── Ideas normalisation ──────────────────────────────────────────────────────

describe('extractSignals — ideas normalisation', () => {
  it('pads ideas array to 5 when fewer are provided', () => {
    const raw = JSON.stringify({
      ideas: ['only one idea'],
      twist: '', question: '', signals: {},
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.ideas.length, 5);
    assert.equal(payload.ideas[0], 'only one idea');
    assert.equal(payload.ideas[1], '(idea not provided)');
  });

  it('truncates ideas array to 7 when more than 7 are provided', () => {
    const raw = JSON.stringify({
      ideas: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
      twist: '', question: '', signals: {},
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.ideas.length, 7);
  });

  it('filters non-string items from ideas', () => {
    const raw = JSON.stringify({
      ideas: ['real idea', 42, null, 'another idea'],
      twist: '', question: '', signals: {},
    });
    const { payload } = extractSignals(raw);
    assert.ok(payload.ideas.every((i) => typeof i === 'string'));
  });

  it('handles missing ideas field gracefully', () => {
    const raw = JSON.stringify({ twist: '', question: '', signals: {} });
    const { payload } = extractSignals(raw);
    assert.equal(payload.ideas.length, 5);
    assert.ok(payload.ideas.every((i) => i === '(idea not provided)'));
  });
});

// ─── Signal sanitisation ──────────────────────────────────────────────────────

describe('extractSignals — signal sanitisation', () => {
  it('rejects unknown signal group names', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { unknown_group: { analytical: 0.1 } },
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.unknown_group, undefined);
  });

  it('rejects unknown keys within a valid group', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { bad_key: 0.1, analytical: 0.1 } },
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.thinking_style?.bad_key, undefined);
    assert.ok(payload.signals.thinking_style?.analytical);
  });

  it('clamps increments above MAX_INCREMENT to MAX_INCREMENT', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: 999 } },
    });
    const { payload } = extractSignals(raw);
    assert.ok(payload.signals.thinking_style.analytical <= 0.15);
  });

  it('clamps increments below MIN_INCREMENT magnitude to that value', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: 0.001 } },
    });
    const { payload } = extractSignals(raw);
    // 0.001 is below MIN_INCREMENT (0.05) but still gets clamped to 0.05
    assert.ok(payload.signals.thinking_style.analytical >= 0.05);
  });

  it('preserves sign of negative increments', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: -0.1 } },
    });
    const { payload } = extractSignals(raw);
    assert.ok(payload.signals.thinking_style.analytical < 0);
  });

  it('clamps zero increment up to MIN_INCREMENT (positive sign)', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: 0 } },
    });
    const { payload } = extractSignals(raw);
    // sanitizeIncrement(0) → sign=+1, abs clamped to MIN_INCREMENT → 0.05
    assert.ok(payload.signals.thinking_style?.analytical >= 0.05);
  });

  it('drops non-finite number increments', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: null, creative: 0.1 } },
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.thinking_style?.analytical, undefined);
    assert.ok(payload.signals.thinking_style?.creative);
  });
});

// ─── Fallback / error path ────────────────────────────────────────────────────

describe('extractSignals — fallback on bad input', () => {
  it('returns a parseError when input is not valid JSON', () => {
    const { parseError, payload } = extractSignals('not json at all');
    assert.ok(typeof parseError === 'string' && parseError.length > 0);
    assert.ok(Array.isArray(payload.ideas));
  });

  it('surfaces raw text as the first idea in fallback', () => {
    const rawText = 'some raw LLM output that is not JSON';
    const { payload } = extractSignals(rawText);
    assert.ok(payload.ideas[0].startsWith('some raw'));
  });

  it('returns a parseError for a JSON array (not an object)', () => {
    const { parseError } = extractSignals('[1, 2, 3]');
    assert.ok(typeof parseError === 'string' && parseError.length > 0);
  });

  it('returns a parseError for a JSON null', () => {
    const { parseError } = extractSignals('null');
    assert.ok(typeof parseError === 'string' && parseError.length > 0);
  });

  it('fallback payload has empty twist, question, and signals', () => {
    const { payload } = extractSignals('bad input');
    assert.equal(payload.twist, '');
    assert.equal(payload.question, '');
    assert.deepEqual(payload.signals, {});
  });
});
