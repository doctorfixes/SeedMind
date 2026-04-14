/**
 * @seedmind/shared
 * Shared growth-ring schema, constants, and utilities used by both
 * the orchestrator and the memory engine.
 */

// ─── Growth-Ring Schema ───────────────────────────────────────────────────────

/**
 * Returns a fresh, empty growth-ring object for a new user.
 * @param {string} userId
 * @returns {GrowthRing}
 */
function createGrowthRing(userId) {
  return {
    userId,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {},   // key → value signals extracted from conversations
    history: [],       // last N topic summaries
    traits: {},        // derived personality / style traits
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY_LENGTH = 20;

const SYSTEM_PROMPT = `You are SeedMind, an adaptive brainstorming assistant.
You learn from each conversation to better understand the user's thinking style,
creative preferences, and domain interests.

When responding:
1. Generate rich, actionable brainstorming ideas.
2. Ask clarifying questions only when genuinely needed.
3. Adapt your tone and depth to match the user's communication style.
4. Incorporate any provided growth-ring context to personalise your output.

Output format:
- Lead with a concise summary idea (1–2 sentences).
- Follow with 3–7 numbered expansion points.
- End with one open-ended follow-up question.`;

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Merges a partial preferences update into an existing growth ring.
 * @param {GrowthRing} ring
 * @param {object} update  Partial fields to merge in.
 * @returns {GrowthRing}   Updated ring (mutated in-place and returned).
 */
function mergeRingUpdate(ring, update) {
  if (update.preferences) {
    ring.preferences = { ...ring.preferences, ...update.preferences };
  }
  if (update.traits) {
    ring.traits = { ...ring.traits, ...update.traits };
  }
  if (update.historyEntry) {
    ring.history.push(update.historyEntry);
    if (ring.history.length > MAX_HISTORY_LENGTH) {
      ring.history = ring.history.slice(-MAX_HISTORY_LENGTH);
    }
  }
  ring.version += 1;
  ring.updatedAt = new Date().toISOString();
  return ring;
}

/**
 * Serialises a growth ring for injection into the LLM system prompt.
 * @param {GrowthRing} ring
 * @returns {string}
 */
function ringToPromptContext(ring) {
  const lines = [`User growth-ring context (v${ring.version}):`];

  if (Object.keys(ring.preferences).length) {
    lines.push('Preferences: ' + JSON.stringify(ring.preferences));
  }
  if (Object.keys(ring.traits).length) {
    lines.push('Traits: ' + JSON.stringify(ring.traits));
  }
  if (ring.history.length) {
    lines.push('Recent topics: ' + ring.history.slice(-5).join(', '));
  }

  return lines.join('\n');
}

/**
 * Extracts lightweight preference signals from an LLM response string.
 * Returns a partial update object suitable for mergeRingUpdate().
 * @param {string} userMessage  The original user message.
 * @param {string} llmResponse  The LLM's response text.
 * @returns {{ preferences?: object, traits?: object, historyEntry?: string }}
 */
function extractSignals(userMessage, llmResponse) {
  const update = {};

  // Persist the topic as a short history entry.
  const topic = userMessage.slice(0, 80).replace(/\s+/g, ' ').trim();
  update.historyEntry = topic;

  // Simple heuristic: detect explicit length/style preferences.
  if (/\b(brief|short|concise|tl;?dr)\b/i.test(userMessage)) {
    update.preferences = { responseLength: 'brief' };
  } else if (/\b(detailed|deep.?dive|expand|thorough)\b/i.test(userMessage)) {
    update.preferences = { responseLength: 'detailed' };
  }

  // Detect domain signals from the message.
  const domains = ['tech', 'science', 'art', 'music', 'business', 'writing', 'design'];
  for (const domain of domains) {
    if (new RegExp(`\\b${domain}\\b`, 'i').test(userMessage)) {
      update.traits = { ...(update.traits || {}), [`domain_${domain}`]: true };
    }
  }

  return update;
}

module.exports = {
  createGrowthRing,
  mergeRingUpdate,
  ringToPromptContext,
  extractSignals,
  SYSTEM_PROMPT,
  MAX_HISTORY_LENGTH,
};
