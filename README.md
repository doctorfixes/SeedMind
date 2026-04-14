# 🌱 SeedMind

> An adaptive brainstorming system that learns from every conversation.

---

## Architecture

```
Client → Orchestrator → LLM → Orchestrator → Memory Engine → Orchestrator → Client
```

| Service | Description | Hosting |
|---|---|---|
| `apps/client` | Static UI (HTML/CSS/JS) | Vercel Static |
| `apps/orchestrator` | Serverless intelligence router | Vercel Serverless |
| `apps/memory-engine` | Node + SQLite growth-ring store | Render (persistent disk) |
| `packages/shared` | Shared schema, constants, utilities | — |
| `packages/types` | JSDoc type definitions | — |

---

## Monorepo Structure

```
seedmind/
├── apps/
│   ├── client/           # Static web UI
│   ├── orchestrator/     # Serverless API — POST /ask
│   └── memory-engine/    # Express + SQLite service
├── packages/
│   ├── shared/           # Growth-ring schema, SYSTEM_PROMPT, utilities
│   └── types/            # JSDoc type definitions
└── README.md
```

---

## Deployment

### Step 1 — Push to GitHub

Push this repository to GitHub. Vercel will detect the monorepo automatically.

---

### Step 2 — Deploy the Memory Engine to Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Root directory: `apps/memory-engine`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add a **Persistent Disk** mounted at `/app` (or set `DB_PATH` env var).
6. Deploy → note your URL, e.g. `https://seedmind-memory.onrender.com`

---

### Step 3 — Deploy the Orchestrator to Vercel

1. **Add New Project** → select `apps/orchestrator`
2. Build command: `npm install`
3. Add environment variables:

| Variable | Value |
|---|---|
| `MEMORY_URL` | `https://seedmind-memory.onrender.com/api/memory` |
| `LLM_URL` | `https://api.openai.com/v1/chat/completions` |
| `LLM_KEY` | Your OpenAI API key |
| `LLM_MODEL` | `gpt-4o-mini` (or preferred model) |

4. Deploy → note your URL, e.g. `https://seedmind-orchestrator.vercel.app`

---

### Step 4 — Deploy the Client to Vercel

1. **Add New Project** → select `apps/client`
2. Framework preset: **None**
3. Output directory: *(leave as root)*
4. Add environment variable:

| Variable | Value |
|---|---|
| `ORCHESTRATOR_URL` | `https://seedmind-orchestrator.vercel.app/ask` |

5. Deploy → your app is live at `https://seedmind.vercel.app`

---

## How It Works — Growth Rings

Each user has a **growth ring** — a lightweight JSON profile that accumulates:

- **preferences** — detected style signals (e.g. `responseLength: 'brief'`)
- **traits** — inferred domain interests (e.g. `domain_tech: true`)
- **history** — the last 20 topic summaries

On every request the orchestrator:

1. Loads the ring from the memory engine
2. Injects it into the LLM system prompt
3. Extracts new signals from the exchange
4. Saves the updated ring back

This creates a feedback loop that makes every conversation more personalised.

---

## Local Development

```bash
# Install all workspace dependencies
npm install

# Start the memory engine (port 3001)
npm run dev:memory

# In another terminal — start the orchestrator (requires env vars)
MEMORY_URL=http://localhost:3001/api/memory \
LLM_KEY=sk-... \
npm run dev:orchestrator

# Serve the client statically
npm run dev:client
```

---

## Environment Variables Reference

### Orchestrator (`apps/orchestrator`)

| Variable | Required | Description |
|---|---|---|
| `LLM_KEY` | ✅ | OpenAI API key |
| `MEMORY_URL` | ✅ | Base URL of the memory engine |
| `LLM_URL` | — | Defaults to OpenAI completions endpoint |
| `LLM_MODEL` | — | Defaults to `gpt-4o-mini` |

### Memory Engine (`apps/memory-engine`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | — | Defaults to `3001` |
| `DB_PATH` | — | Path to SQLite file, defaults to `./seedmind.db` |

---

## License

MIT