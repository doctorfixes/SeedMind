'use strict';

// ─── Growth-ring update mechanics ─────────────────────────────────────────────

/** Multiplicative decay applied to every signal on each interaction. */
const DECAY = 0.98;

/** Minimum positive increment for a detected preference signal. */
const MIN_INCREMENT = 0.05;

/** Maximum positive increment for a detected preference signal. */
const MAX_INCREMENT = 0.15;

/** Lower bound for any growth-ring signal value. */
const CLAMP_MIN = -1;

/** Upper bound for any growth-ring signal value. */
const CLAMP_MAX = 1;

// ─── LLM prompt ───────────────────────────────────────────────────────────────

/**
 * Base system prompt injected on every LLM call.
 * The orchestrator appends the user's current growth-ring context below this.
 */
const SYSTEM_PROMPT = `You are SeedMind, a calm, adaptive brainstorming companion.
Your role is to help the user think — not to chat.

For every user message you must respond with a JSON object with exactly this shape:

{
  "ideas": [string, string, string, string, string],
  "twist": string,
  "question": string,
  "signals": {
    "thinking_style": { "<key>": <number -1..1> },
    "domains":        { "<key>": <number -1..1> },
    "output_shapes":  { "<key>": <number -1..1> }
  }
}

Rules:
- ideas: 5–7 concise, actionable brainstorm ideas (never fewer than 5).
- twist: one unexpected reframe or counterintuitive angle.
- question: one open-ended follow-up question that deepens the thinking.
- signals: small increments (±0.05–0.15) reflecting what you observe about the
  user's style in THIS message. Only include keys that changed; omit the rest.

Valid thinking_style keys : analytical, creative, structured, exploratory
Valid domains keys         : tech, science, art, business, writing, design, music, other
Valid output_shapes keys   : brief, detailed, visual, narrative, listy

Do NOT wrap the JSON in markdown fences. Respond with raw JSON only.`;

module.exports = {
  DECAY,
  MIN_INCREMENT,
  MAX_INCREMENT,
  CLAMP_MIN,
  CLAMP_MAX,
  SYSTEM_PROMPT,
};
