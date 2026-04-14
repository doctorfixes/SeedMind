/**
 * @seedmind/types
 * JSDoc type definitions shared across the monorepo.
 * (No runtime code — import for editor intellisense only.)
 */

/**
 * @typedef {object} GrowthRing
 * @property {string}  userId       Unique identifier for the user.
 * @property {number}  version      Monotonically increasing version counter.
 * @property {string}  createdAt    ISO-8601 creation timestamp.
 * @property {string}  updatedAt    ISO-8601 last-updated timestamp.
 * @property {object}  preferences  Key/value user preference signals.
 * @property {string[]} history     Short summaries of recent topics.
 * @property {object}  traits       Derived personality / style traits.
 */

/**
 * @typedef {object} AskRequest
 * @property {string} userId   Caller's user ID.
 * @property {string} message  The user's raw brainstorm prompt.
 */

/**
 * @typedef {object} AskResponse
 * @property {string} response  The LLM-generated brainstorm text.
 * @property {number} version   Growth-ring version after this request.
 */

module.exports = {};
