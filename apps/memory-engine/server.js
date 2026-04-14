'use strict';

/**
 * SeedMind Memory Engine
 *
 * Provides persistent growth-ring storage backed by SQLite.
 *
 * Endpoints:
 *   GET  /health                     — health check
 *   GET  /api/memory/:userId         — load a growth ring
 *   POST /api/memory/:userId         — apply a partial update to a growth ring
 */

const express = require('express');
const { createGrowthRing, mergeRingUpdate } = require('@seedmind/shared');

// ─── Validation ───────────────────────────────────────────────────────────────
function isValidUserId(userId) {
  return (
    typeof userId === 'string' &&
    userId.length > 0 &&
    userId.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(userId)
  );
}

// ─── App Factory ──────────────────────────────────────────────────────────────

/**
 * Creates and returns the Express app wired to the provided SQLite db handle.
 * Separating app creation from database initialisation allows tests to inject
 * a lightweight mock db without depending on the native better-sqlite3 binary.
 *
 * @param {object} db  A better-sqlite3 (or compatible) database instance.
 * @returns {import('express').Application}
 */
function createApp(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS growth_rings (
      user_id    TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Prepared statements
  const stmtGet    = db.prepare('SELECT data FROM growth_rings WHERE user_id = ?');
  const stmtUpsert = db.prepare(`
    INSERT INTO growth_rings (user_id, data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      data       = excluded.data,
      updated_at = excluded.updated_at
  `);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function loadRing(userId) {
    const row = stmtGet.get(userId);
    if (!row) return createGrowthRing(userId);
    try {
      return JSON.parse(row.data);
    } catch {
      return createGrowthRing(userId);
    }
  }

  function persistRing(ring) {
    stmtUpsert.run(ring.userId, JSON.stringify(ring), ring.meta.last_updated ?? new Date().toISOString());
  }

  // ─── Express app ────────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Load growth ring
  app.get('/api/memory/:userId', (req, res) => {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
      const ring = loadRing(userId);
      return res.json(ring);
    } catch (err) {
      console.error('[memory-engine] GET error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Apply partial update to a growth ring
  app.post('/api/memory/:userId', (req, res) => {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const update = req.body;
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    try {
      const ring = loadRing(userId);
      const updated = mergeRingUpdate(ring, update);
      persistRing(updated);
      return res.json({ total_interactions: updated.meta.total_interactions, last_updated: updated.meta.last_updated });
    } catch (err) {
      console.error('[memory-engine] POST error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

// ─── Start (only when run directly) ──────────────────────────────────────────
if (require.main === module) {
  const path     = require('path');
  const Database = require('better-sqlite3');

  const PORT    = process.env.PORT    || 3001;
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'seedmind.db');

  const db  = new Database(DB_PATH);
  const app = createApp(db);

  app.listen(PORT, () => {
    console.log(`[memory-engine] Listening on port ${PORT}`);
    console.log(`[memory-engine] Database: ${DB_PATH}`);
  });
}

module.exports = { createApp, isValidUserId };
