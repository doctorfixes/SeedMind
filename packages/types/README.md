# @seedmind/types

TypeScript type definitions for the SeedMind v1 system.

## Usage

```ts
import type { GrowthRing, AskRequest, AskResponse, LLMPayload } from '@seedmind/types';
```

## Key Types

| Type | Description |
|---|---|
| `GrowthRing` | Full growth-ring record for one user |
| `SignalUpdate` | Partial signal deltas from the LLM |
| `AskRequest` | POST `/ask` request body |
| `AskResponse` | POST `/ask` response body |
| `LLMPayload` | Structured JSON the LLM must return |
| `MemoryUpdateResponse` | POST `/api/memory/:userId` response |
