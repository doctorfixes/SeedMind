# @seedmind/shared

Shared growth-ring schema, constants, and utilities used by both the **orchestrator** and the **memory engine**.

## Exports

| Export | Type | Description |
|---|---|---|
| `createGrowthRing(userId)` | function | Returns a fresh growth ring cloned from the schema |
| `mergeRingUpdate(ring, signals)` | function | Applies decay → increment → clamp to a ring |
| `ringToPromptContext(ring)` | function | Serialises top signals for the LLM system prompt |
| `SYSTEM_PROMPT` | string | Base LLM system prompt |
| `DECAY` | number | `0.98` — per-interaction decay multiplier |
| `MIN_INCREMENT` | number | `0.05` — minimum signal increment |
| `MAX_INCREMENT` | number | `0.15` — maximum signal increment |
| `CLAMP_MIN` | number | `-1` |
| `CLAMP_MAX` | number | `1` |

## Growth-Ring Update Mechanics

On every interaction:

1. **Decay** — multiply every signal by `0.98` (gradual forgetting)
2. **Increment** — add the LLM-returned signal deltas (`±0.05–0.15`)
3. **Clamp** — keep all values in `[-1, 1]`
4. **Metadata** — increment `total_interactions`, update `last_updated`

This keeps learning gradual, safe, reversible, and transparent.

## Files

| File | Description |
|---|---|
| `growthRingSchema.json` | Canonical zero-state schema |
| `constants.js` | Numeric constants + `SYSTEM_PROMPT` |
| `index.js` | Main entry point |
