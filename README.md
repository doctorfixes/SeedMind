# 🌱 SeedMind

> A tiny, adaptive brainstorming companion that learns your thinking style over time.

SeedMind helps you think better by generating structured ideas, adding a twist, and asking a clarifying question — all while gradually adapting to your preferences through a transparent, safe memory model called **growth rings**.

SeedMind is intentionally small, calm, and deterministic. It's a thinking tool, not a chatbot.

---

## Architecture

```
User → Client → Orchestrator → LLM → Orchestrator → Memory Engine → Orchestrator → Client
```

| Service | Description | Hosting |
|---|---|---|
| `apps/client` | Static UI (HTML/CSS/JS) | Vercel Static |
| `apps/orchestrator` | Serverless intelligence router | Vercel Serverless |
| `apps/memory-engine` | Node + SQLite growth-ring store | Render / Fly / Railway |
| `packages/shared` | Growth-ring schema, constants, utilities | — |
| `packages/types` | TypeScript type definitions | — |

---

## Monorepo Structure

```
seedmind/
│
├── apps/
│   ├── client/              # Vercel static site
│   │   ├── index.html
│   │   ├── script.js
│   │   ├── styles.css
│   │   └── vercel.json
│   │
│   ├── orchestrator/        # Vercel serverless API
│   │   ├── api/
│   │   │   └── ask.js
│   │   ├── updateGrowthRings.js
│   │   ├── extractSignals.js
│   │   ├── package.json
│   │   └── vercel.json
│   │
│   └── memory-engine/       # Render/Fly persistent service
│       ├── server.js
│       ├── package.json
│       ├── Dockerfile
│       ├── docker-compose.yml
│       └── seedmind.db      # auto-created at runtime
│
├── packages/
│   ├── shared/
│   │   ├── growthRingSchema.json
│   │   ├── constants.js
│   │   ├── index.js
│   │   └── README.md
│   │
│   └── types/
│       ├── index.d.ts
│       ├── index.js
│       └── README.md
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## How SeedMind Works

### 1. User asks a question

The client sends the message to the orchestrator.

### 2. Orchestrator loads growth rings

Growth rings store:
- thinking style preferences (`analytical`, `creative`, `structured`, `exploratory`)
- domain interests (`tech`, `science`, `art`, `business`, `writing`, `design`, `music`)
- output format preferences (`brief`, `detailed`, `visual`, `narrative`, `listy`)
- metadata (`total_interactions`, `last_updated`, `version`)

### 3. Orchestrator calls the LLM

It injects the SeedMind system prompt + the user message + the top growth-ring signals.

The LLM returns structured JSON:

```json
{
  "ideas":    ["...", "...", "...", "...", "..."],
  "twist":    "...",
  "question": "...",
  "signals":  {
    "thinking_style": { "analytical": 0.1 },
    "domains":        { "tech": 0.08 }
  }
}
```

### 4. Growth rings update

The orchestrator applies:
1. **Decay** — multiply every signal by `0.98`
2. **Add** — apply the LLM-returned deltas (`±0.05–0.15`)
3. **Clamp** — keep all values in `[-1, 1]`
4. **Meta** — increment `total_interactions`, update `last_updated`

### 5. Memory engine persists the update

SQLite stores the new growth rings.

### 6. Client displays the brainstorm

```
💡 Ideas

1. …
2. …
…

🌀 Twist
…

❓ …
```

---

## Deployment

### 1. Deploy the Memory Engine (Render / Fly / Railway)

**Path:** `apps/memory-engine`

#### Option A — Render

1. Create a new **Web Service**
2. Connect the repo, root directory: `apps/memory-engine`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add a **Persistent Disk** mounted at `/data`
6. Set env var: `DB_PATH=/data/seedmind.db`
7. Deploy

#### Option B — Docker (any platform)

```bash
cd apps/memory-engine
docker compose up -d
```

You now have: `https://seedmind-memory.onrender.com`

---

### 2. Deploy the Client + Orchestrator (Vercel — unified)

The repository includes a root-level `vercel.json` that deploys the client and
orchestrator as a **single Vercel project**. This resolves workspace package
dependencies and ensures the theme CSS is available at deployment time.

1. **Add New Project** → connect the repository root (no subdirectory)
2. Framework preset: **Other**
3. Root directory: *(leave empty — use repo root)*
4. Add environment variables:

| Variable | Value |
|---|---|
| `LLM_KEY` | Your OpenAI API key |
| `MEMORY_URL` | `https://seedmind-memory.onrender.com/api/memory` |
| `LLM_URL` | `https://api.openai.com/v1/chat/completions` *(optional)* |
| `LLM_MODEL` | `gpt-4o-mini` *(optional)* |

5. Deploy

You now have: `https://seedmind.vercel.app` (UI at `/`, API at `/ask`)

---

## Local Development

```bash
# Install all workspace dependencies
npm install

# Terminal 1 — Memory Engine (port 3001)
cd apps/memory-engine
node server.js

# Terminal 2 — Client + Orchestrator (unified, uses root vercel.json)
MEMORY_URL=http://localhost:3001/api/memory \
LLM_KEY=sk-... \
vercel dev
# Opens on http://localhost:3000 — UI at / and API at /ask
```

---

## Growth Rings — Adaptive Memory Model

Each user has a tiny, explainable JSON growth ring:

```json
{
  "thinking_style": { "analytical": 0, "creative": 0, "structured": 0, "exploratory": 0 },
  "domains":        { "tech": 0, "science": 0, "art": 0, "business": 0, "writing": 0, "design": 0, "music": 0, "other": 0 },
  "output_shapes":  { "brief": 0, "detailed": 0, "visual": 0, "narrative": 0, "listy": 0 },
  "meta": {
    "total_interactions": 0,
    "last_updated": null,
    "version": "1.0"
  }
}
```

Every interaction applies:
- **0.98 decay** — gradual forgetting
- **±0.05–0.15 increments** — learning from each exchange
- **clamping to [-1, 1]** — bounded, safe values
- **metadata updates** — transparent history

This keeps learning gradual, safe, reversible, and transparent.

---

## Environment Variables

### Orchestrator (`apps/orchestrator`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_KEY` | ✅ | — | OpenAI API key |
| `MEMORY_URL` | ✅ | — | Base URL of the memory engine |
| `LLM_URL` | — | OpenAI completions | LLM endpoint |
| `LLM_MODEL` | — | `gpt-4o-mini` | Model name |

### Memory Engine (`apps/memory-engine`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | — | `3001` | HTTP listen port |
| `DB_PATH` | — | `./seedmind.db` | Path to SQLite database file |

---

## License

MIT
