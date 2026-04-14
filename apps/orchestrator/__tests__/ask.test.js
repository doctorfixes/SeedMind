'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/ask.js');
const { formatBrainstorm } = handler;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    _status: 200,
    _body:   null,
    _ended:  false,
    status(code) { this._status = code; return this; },
    json(body)   { this._body = body;   return this; },
    end()        { this._ended = true;  return this; },
    setHeader()  {},
  };
  return res;
}

function mockReq(overrides = {}) {
  return {
    method: 'POST',
    body:   { userId: 'user1', message: 'hello world' },
    ...overrides,
  };
}

// ─── formatBrainstorm ─────────────────────────────────────────────────────────

describe('formatBrainstorm', () => {
  it('returns a string', () => {
    const result = formatBrainstorm({ ideas: [], twist: '', question: '' });
    assert.equal(typeof result, 'string');
  });

  it('includes the ideas header', () => {
    const result = formatBrainstorm({ ideas: ['idea A'], twist: '', question: '' });
    assert.ok(result.includes('💡 Ideas'), `Expected header in: ${result}`);
  });

  it('numbers each idea starting at 1', () => {
    const result = formatBrainstorm({ ideas: ['first', 'second', 'third'], twist: '', question: '' });
    assert.ok(result.includes('1. first'));
    assert.ok(result.includes('2. second'));
    assert.ok(result.includes('3. third'));
  });

  it('includes the twist section when twist is non-empty', () => {
    const result = formatBrainstorm({ ideas: [], twist: 'unexpected angle', question: '' });
    assert.ok(result.includes('🌀 Twist'));
    assert.ok(result.includes('unexpected angle'));
  });

  it('omits the twist section when twist is an empty string', () => {
    const result = formatBrainstorm({ ideas: [], twist: '', question: '' });
    assert.ok(!result.includes('🌀 Twist'));
  });

  it('includes the question section when question is non-empty', () => {
    const result = formatBrainstorm({ ideas: [], twist: '', question: 'What if?' });
    assert.ok(result.includes('❓'));
    assert.ok(result.includes('What if?'));
  });

  it('omits the question section when question is an empty string', () => {
    const result = formatBrainstorm({ ideas: [], twist: '', question: '' });
    assert.ok(!result.includes('❓'));
  });

  it('includes all three sections when all fields are populated', () => {
    const result = formatBrainstorm({
      ideas:    ['idea 1', 'idea 2'],
      twist:    'flip it',
      question: 'Why not?',
    });
    assert.ok(result.includes('1. idea 1'));
    assert.ok(result.includes('🌀 Twist'));
    assert.ok(result.includes('flip it'));
    assert.ok(result.includes('❓'));
    assert.ok(result.includes('Why not?'));
  });
});

// ─── handler — request validation ─────────────────────────────────────────────

describe('handler — CORS pre-flight', () => {
  it('responds 204 to OPTIONS requests', async () => {
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 204);
    assert.ok(res._ended);
  });
});

describe('handler — method guard', () => {
  it('responds 405 to GET requests', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 405);
    assert.equal(res._body?.error, 'Method not allowed');
  });

  it('responds 405 to DELETE requests', async () => {
    const req = mockReq({ method: 'DELETE' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 405);
  });
});

describe('handler — userId validation', () => {
  it('responds 400 when userId is missing', async () => {
    const req = mockReq({ body: { message: 'hello' } });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body?.error);
  });

  it('responds 400 when userId is not a string', async () => {
    const req = mockReq({ body: { userId: 42, message: 'hello' } });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 400);
  });

  it('responds 400 when userId exceeds 128 characters', async () => {
    const req = mockReq({ body: { userId: 'a'.repeat(129), message: 'hello' } });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 400);
  });

  it('accepts a userId of exactly 128 characters (proceeds past validation)', async () => {
    // It will fail at LLM call, but shouldn't return a 400
    const req = mockReq({ body: { userId: 'a'.repeat(128), message: 'hello' } });
    const res = mockRes();
    await handler(req, res).catch(() => {});
    assert.notEqual(res._status, 400);
  });
});

describe('handler — message validation', () => {
  it('responds 400 when message is missing', async () => {
    const req = mockReq({ body: { userId: 'user1' } });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body?.error);
  });

  it('responds 400 when message is not a string', async () => {
    const req = mockReq({ body: { userId: 'user1', message: 123 } });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 400);
  });

  it('responds 400 when message is only whitespace', async () => {
    const req = mockReq({ body: { userId: 'user1', message: '   ' } });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 400);
  });

  it('responds 400 when message exceeds 4000 characters', async () => {
    const req = mockReq({ body: { userId: 'user1', message: 'x'.repeat(4001) } });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body?.error?.toLowerCase().includes('long'));
  });

  it('accepts a message of exactly 4000 characters (proceeds past validation)', async () => {
    const req = mockReq({ body: { userId: 'user1', message: 'x'.repeat(4000) } });
    const res = mockRes();
    await handler(req, res).catch(() => {});
    assert.notEqual(res._status, 400);
  });
});
