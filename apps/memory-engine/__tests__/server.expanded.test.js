'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');

const { createApp, isValidUserId } = require('../server.js');

// ─── Mock database ────────────────────────────────────────────────────────────

function createMockDb(initialStore = {}) {
  const store = Object.assign({}, initialStore);
  return {
    _store: store,
    exec() {},
    prepare(sql) {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return {
          get(userId) {
            return store[userId] !== undefined ? { data: store[userId] } : undefined;
          },
        };
      }
      return {
        run(userId, json, _ts) {
          store[userId] = json;
        },
      };
    },
  };
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function req(server, method, path, body) {
  const port = server.address().port;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(`http://localhost:${port}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, body: data };
}

// ─── isValidUserId — expanded ─────────────────────────────────────────────────

describe('isValidUserId — expanded', () => {
  it('accepts a single character id', () => {
    assert.ok(isValidUserId('a'));
  });

  it('rejects an id with dots', () => {
    assert.ok(!isValidUserId('user.name'));
  });

  it('rejects an id with forward slash', () => {
    assert.ok(!isValidUserId('user/path'));
  });

  it('rejects an id with encoded special characters', () => {
    // The raw string "user%40bad" is tested; the regex should reject %
    assert.ok(!isValidUserId('user%40bad'));
  });

  it('accepts numeric-only ids', () => {
    assert.ok(isValidUserId('12345'));
  });

  it('rejects an empty object', () => {
    assert.ok(!isValidUserId({}));
  });

  it('rejects an array', () => {
    assert.ok(!isValidUserId(['abc']));
  });
});

// ─── GET /api/memory/:userId — expanded ──────────────────────────────────────

describe('GET /api/memory/:userId — expanded', () => {
  let server;
  let db;
  before(() => {
    db = createMockDb();
    const app = createApp(db);
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, resolve));
  });
  after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  it('returns a fresh ring with meta.version = "1.0"', async () => {
    const { body } = await req(server, 'GET', '/api/memory/version-check-user');
    assert.equal(body.meta.version, '1.0');
  });

  it('returns fresh ring with all signal groups initialised to zeros', async () => {
    const { body } = await req(server, 'GET', '/api/memory/zeroed-user');
    for (const val of Object.values(body.thinking_style)) {
      assert.equal(val, 0);
    }
    for (const val of Object.values(body.domains)) {
      assert.equal(val, 0);
    }
    for (const val of Object.values(body.output_shapes)) {
      assert.equal(val, 0);
    }
  });

  it('returns userId matching the path parameter', async () => {
    const { body } = await req(server, 'GET', '/api/memory/myuser123');
    assert.equal(body.userId, 'myuser123');
  });
});

// ─── POST /api/memory/:userId — expanded ─────────────────────────────────────

describe('POST /api/memory/:userId — expanded', () => {
  let server;
  let db;
  before(() => {
    db = createMockDb();
    const app = createApp(db);
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, resolve));
  });
  after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  it('applies a domains signal increment', async () => {
    await req(server, 'POST', '/api/memory/domain-user', {
      domains: { science: 0.1 },
    });
    const { body } = await req(server, 'GET', '/api/memory/domain-user');
    assert.ok(Math.abs(body.domains.science - 0.1) < 1e-9);
  });

  it('applies output_shapes signal increment', async () => {
    await req(server, 'POST', '/api/memory/shape-user', {
      output_shapes: { visual: 0.1 },
    });
    const { body } = await req(server, 'GET', '/api/memory/shape-user');
    assert.ok(Math.abs(body.output_shapes.visual - 0.1) < 1e-9);
  });

  it('applies decay to existing values on subsequent updates', async () => {
    await req(server, 'POST', '/api/memory/decay-user', {
      thinking_style: { analytical: 0.1 },
    });
    // Second update with 0 increment — should apply decay to the 0.1
    await req(server, 'POST', '/api/memory/decay-user', {});
    const { body } = await req(server, 'GET', '/api/memory/decay-user');
    // After second call: 0.1 * 0.98 = 0.098
    assert.ok(body.thinking_style.analytical < 0.1);
    assert.ok(body.thinking_style.analytical > 0.09);
  });

  it('ignores unknown signal keys without error', async () => {
    const { status } = await req(server, 'POST', '/api/memory/unknown-key-user', {
      thinking_style: { nonexistent_key: 0.1 },
    });
    assert.equal(status, 200);
    const { body } = await req(server, 'GET', '/api/memory/unknown-key-user');
    assert.equal(body.thinking_style.nonexistent_key, undefined);
  });

  it('returns 400 for a non-JSON body (number)', async () => {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/memory/num-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '42',
    });
    // Express body-parser rejects non-object JSON with a 400
    assert.equal(res.status, 400);
  });

  it('returns 400 for a null body', async () => {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/memory/null-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    assert.equal(res.status, 400);
  });
});

// ─── Unsupported methods ─────────────────────────────────────────────────────

describe('Unsupported methods', () => {
  let server;
  before(() => {
    const app = createApp(createMockDb());
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, resolve));
  });
  after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  it('returns 404 for PUT /api/memory/:userId', async () => {
    const { status } = await req(server, 'PUT', '/api/memory/put-user', {});
    assert.equal(status, 404);
  });

  it('returns 404 for DELETE /api/memory/:userId', async () => {
    const { status } = await req(server, 'DELETE', '/api/memory/del-user');
    assert.equal(status, 404);
  });

  it('returns 404 for unknown routes', async () => {
    const { status } = await req(server, 'GET', '/unknown/route');
    assert.equal(status, 404);
  });
});
