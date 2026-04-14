'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');

const { createApp, isValidUserId } = require('../server.js');

// ─── Mock database ────────────────────────────────────────────────────────────

/**
 * Builds a lightweight in-memory db compatible with better-sqlite3's API.
 * @param {Record<string, string>} [initialStore]  Pre-seeded userId → JSON rows.
 */
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
      // INSERT … ON CONFLICT … (upsert)
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

// ─── isValidUserId ────────────────────────────────────────────────────────────

describe('isValidUserId', () => {
  it('accepts alphanumeric ids', () => {
    assert.ok(isValidUserId('user123'));
  });

  it('accepts ids with underscores and hyphens', () => {
    assert.ok(isValidUserId('user_id-test'));
  });

  it('rejects an empty string', () => {
    assert.ok(!isValidUserId(''));
  });

  it('rejects a userId longer than 128 characters', () => {
    assert.ok(!isValidUserId('a'.repeat(129)));
  });

  it('accepts a userId of exactly 128 characters', () => {
    assert.ok(isValidUserId('a'.repeat(128)));
  });

  it('rejects ids with spaces', () => {
    assert.ok(!isValidUserId('user id'));
  });

  it('rejects ids with special characters like @', () => {
    assert.ok(!isValidUserId('user@domain'));
  });

  it('rejects non-string values', () => {
    assert.ok(!isValidUserId(null));
    assert.ok(!isValidUserId(undefined));
    assert.ok(!isValidUserId(42));
  });
});

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  let server;
  before(() => {
    const app = createApp(createMockDb());
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, resolve));
  });
  after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  it('returns 200', async () => {
    const { status } = await req(server, 'GET', '/health');
    assert.equal(status, 200);
  });

  it('returns { status: "ok" }', async () => {
    const { body } = await req(server, 'GET', '/health');
    assert.equal(body.status, 'ok');
  });

  it('includes a ts ISO timestamp', async () => {
    const { body } = await req(server, 'GET', '/health');
    assert.ok(typeof body.ts === 'string');
    assert.ok(!isNaN(Date.parse(body.ts)));
  });
});

// ─── GET /api/memory/:userId ──────────────────────────────────────────────────

describe('GET /api/memory/:userId', () => {
  let server;
  let db;
  before(() => {
    db = createMockDb();
    const app = createApp(db);
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, resolve));
  });
  after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  it('returns 400 for an invalid userId (special chars)', async () => {
    const { status, body } = await req(server, 'GET', '/api/memory/user%40bad');
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it('returns a fresh growth ring when userId is not in the store', async () => {
    const { status, body } = await req(server, 'GET', '/api/memory/new-user');
    assert.equal(status, 200);
    assert.equal(body.userId, 'new-user');
    assert.equal(body.meta.total_interactions, 0);
  });

  it('returns the persisted ring for a known userId', async () => {
    // Pre-seed a ring directly in the store
    const { createGrowthRing } = require('@seedmind/shared');
    const ring = createGrowthRing('seeded-user');
    ring.meta.total_interactions = 5;
    db._store['seeded-user'] = JSON.stringify(ring);

    const { status, body } = await req(server, 'GET', '/api/memory/seeded-user');
    assert.equal(status, 200);
    assert.equal(body.userId, 'seeded-user');
    assert.equal(body.meta.total_interactions, 5);
  });

  it('returns a fresh ring when stored data is corrupt JSON', async () => {
    db._store['corrupt-user'] = 'not-valid-json{{{';
    const { status, body } = await req(server, 'GET', '/api/memory/corrupt-user');
    assert.equal(status, 200);
    assert.equal(body.userId, 'corrupt-user');
    assert.equal(body.meta.total_interactions, 0);
  });
});

// ─── POST /api/memory/:userId ─────────────────────────────────────────────────

describe('POST /api/memory/:userId', () => {
  let server;
  let db;
  before(() => {
    db = createMockDb();
    const app = createApp(db);
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, resolve));
  });
  after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  it('returns 400 for an invalid userId', async () => {
    const { status, body } = await req(server, 'POST', '/api/memory/bad%40user', {});
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it('returns 400 when the body is a JSON array', async () => {
    const { status, body } = await req(server, 'POST', '/api/memory/valid-user', [1, 2, 3]);
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it('returns 200 and increments total_interactions', async () => {
    const { status, body } = await req(server, 'POST', '/api/memory/track-user', {});
    assert.equal(status, 200);
    assert.equal(body.total_interactions, 1);
  });

  it('returns a valid ISO last_updated timestamp', async () => {
    const { body } = await req(server, 'POST', '/api/memory/ts-user', {});
    assert.ok(typeof body.last_updated === 'string');
    assert.ok(!isNaN(Date.parse(body.last_updated)));
  });

  it('persists the updated ring so a subsequent GET reflects the change', async () => {
    await req(server, 'POST', '/api/memory/persist-user', {});
    await req(server, 'POST', '/api/memory/persist-user', {});
    const { body } = await req(server, 'GET', '/api/memory/persist-user');
    assert.equal(body.meta.total_interactions, 2);
  });

  it('applies a thinking_style signal increment', async () => {
    await req(server, 'POST', '/api/memory/signal-user', {
      thinking_style: { analytical: 0.1 },
    });
    const { body } = await req(server, 'GET', '/api/memory/signal-user');
    assert.ok(Math.abs(body.thinking_style.analytical - 0.1) < 1e-9);
  });

  it('handles an empty signal update without error', async () => {
    const { status } = await req(server, 'POST', '/api/memory/empty-signals-user', {});
    assert.equal(status, 200);
  });
});
