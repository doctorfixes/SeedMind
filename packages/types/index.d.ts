/**
 * @seedmind/types
 * TypeScript type definitions for the SeedMind v1 system.
 *
 * Install:  npm install @seedmind/types
 * Usage:    import type { GrowthRing } from '@seedmind/types';
 */

// ─── Growth Ring ──────────────────────────────────────────────────────────────

export interface ThinkingStyle {
  analytical:  number;
  creative:    number;
  structured:  number;
  exploratory: number;
}

export interface Domains {
  tech:     number;
  science:  number;
  art:      number;
  business: number;
  writing:  number;
  design:   number;
  music:    number;
  other:    number;
}

export interface OutputShapes {
  brief:     number;
  detailed:  number;
  visual:    number;
  narrative: number;
  listy:     number;
}

export interface RingMeta {
  total_interactions: number;
  last_updated:       string | null;
  version:            string;
}

/** Full growth-ring record for a single user. */
export interface GrowthRing {
  userId:         string;
  thinking_style: ThinkingStyle;
  domains:        Domains;
  output_shapes:  OutputShapes;
  meta:           RingMeta;
}

// ─── Signal Update ────────────────────────────────────────────────────────────

/** Partial signal deltas returned by the LLM and applied by updateGrowthRings. */
export interface SignalUpdate {
  thinking_style?: Partial<ThinkingStyle>;
  domains?:        Partial<Domains>;
  output_shapes?:  Partial<OutputShapes>;
}

// ─── API Contracts ────────────────────────────────────────────────────────────

/** Request body for POST /ask */
export interface AskRequest {
  userId:  string;
  message: string;
}

/** Response body from POST /ask */
export interface AskResponse {
  response: string;   // formatted brainstorm (ideas + twist + question)
  version:  number;   // total_interactions after this request
}

/** Structured payload the LLM must return (parsed by the orchestrator). */
export interface LLMPayload {
  ideas:    string[];
  twist:    string;
  question: string;
  signals:  SignalUpdate;
}

// ─── Memory Engine API ────────────────────────────────────────────────────────

/** Response body from POST /api/memory/:userId */
export interface MemoryUpdateResponse {
  total_interactions: number;
  last_updated:       string;
}
