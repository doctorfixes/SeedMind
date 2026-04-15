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

// ─── fallbackPayload — ideas padding ─────────────────────────────────────────

describe('extractSignals — fallback ideas padding', () => {
  it('pads fallback ideas to at least 5 entries', () => {
    const { payload } = extractSignals('not json at all');
    assert.equal(payload.ideas.length, 5);
  });

  it('has the raw text as the first fallback idea', () => {
    const { payload } = extractSignals('some raw text');
    assert.ok(payload.ideas[0].startsWith('some raw'));
  });

  it('fills remaining fallback ideas with placeholder', () => {
    const { payload } = extractSignals('raw');
    for (let i = 1; i < 5; i++) {
      assert.equal(payload.ideas[i], '(idea not provided)');
    }
  });

  it('truncates raw text to 500 chars in fallback first idea', () => {
    const longText = 'x'.repeat(1000);
    const { payload } = extractSignals(longText);
    assert.equal(payload.ideas[0].length, 500);
  });
});

// ─── sanitizeIncrement edge cases ─────────────────────────────────────────────

describe('extractSignals — sanitizeIncrement edge cases', () => {
  it('drops NaN signal values (string in JSON)', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: 'not a number' } },
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.thinking_style?.analytical, undefined);
  });

  it('drops boolean signal values', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: true } },
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.thinking_style?.analytical, undefined);
  });

  it('handles Infinity by clamping to MAX_INCREMENT', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: Infinity } },
    });
    // JSON.stringify(Infinity) becomes null, so it should be dropped
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.thinking_style?.analytical, undefined);
  });

  it('handles negative values below -MAX_INCREMENT', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: { analytical: -999 } },
    });
    const { payload } = extractSignals(raw);
    assert.ok(payload.signals.thinking_style.analytical >= -0.15);
    assert.ok(payload.signals.thinking_style.analytical < 0);
  });
});

// ─── Twist and question edge cases ────────────────────────────────────────────

describe('extractSignals — twist and question type coercion', () => {
  it('coerces a numeric twist to empty string', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: 42, question: '', signals: {},
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.twist, '');
  });

  it('coerces a null question to empty string', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: null, signals: {},
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.question, '');
  });

  it('coerces an array twist to empty string', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: ['foo'], question: '', signals: {},
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.twist, '');
  });
});

// ─── Multiple signal groups at once ──────────────────────────────────────────

describe('extractSignals — multi-group signals', () => {
  it('processes all three signal groups simultaneously', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: {
        thinking_style: { analytical: 0.1, creative: -0.1 },
        domains:        { tech: 0.1, art: 0.05 },
        output_shapes:  { brief: 0.1 },
      },
    });
    const { payload } = extractSignals(raw);
    assert.ok(payload.signals.thinking_style?.analytical > 0);
    assert.ok(payload.signals.thinking_style?.creative < 0);
    assert.ok(payload.signals.domains?.tech > 0);
    assert.ok(payload.signals.domains?.art > 0);
    assert.ok(payload.signals.output_shapes?.brief > 0);
  });

  it('drops empty signal groups entirely', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: {
        thinking_style: {},
        domains:        { tech: 0.1 },
      },
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.thinking_style, undefined);
    assert.ok(payload.signals.domains?.tech > 0);
  });
});

// ─── Markdown fence variations ───────────────────────────────────────────────

describe('extractSignals — additional markdown fence handling', () => {
  it('strips fence with extra whitespace', () => {
    const raw = '```json  \n' + validPayload() + '\n  ```';
    const { parseError } = extractSignals(raw);
    assert.equal(parseError, null);
  });

  it('handles JSON with no fences and leading/trailing whitespace', () => {
    const raw = '   \n' + validPayload() + '\n   ';
    const { parseError } = extractSignals(raw);
    assert.equal(parseError, null);
  });
});

// ─── Missing signals field ──────────────────────────────────────────────────

describe('extractSignals — missing or null signals', () => {
  it('handles completely missing signals field', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: 'twist', question: 'q',
    });
    const { payload, parseError } = extractSignals(raw);
    assert.equal(parseError, null);
    assert.deepEqual(payload.signals, {});
  });

  it('handles null signals field', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: null,
    });
    const { payload, parseError } = extractSignals(raw);
    assert.equal(parseError, null);
    assert.deepEqual(payload.signals, {});
  });

  it('handles signals where a group is a string instead of object', () => {
    const raw = JSON.stringify({
      ideas: ['i1','i2','i3','i4','i5'],
      twist: '', question: '',
      signals: { thinking_style: 'bad' },
    });
    const { payload } = extractSignals(raw);
    assert.equal(payload.signals.thinking_style, undefined);
  });
});
