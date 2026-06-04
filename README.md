# EthanExpert — AI Persona Agent

An AI-powered expert page where visitors chat with **EthanExpert** — a deeply informed AI guide to the life, work, and ideas of Ethan Watters, American journalist and author.

**Live:** https://ethan-expert.pages.dev  
**Admin:** https://ethan-expert.pages.dev/?secret-agent-ethan

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Pages (static)                              │
│  index.html  — public-facing chat UI                   │
│  admin.html  — password-protected admin panel          │
└────────────────────┬────────────────────────────────────┘
                     │ POST /  (messages only — no system)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker  (ethan-expert-proxy)                │
│                                                         │
│  On every chat request, the worker:                     │
│  1. Reads behavior prompt, KB, negative prompt from KV  │
│  2. Assembles: system = behavior + KB + negative        │
│  3. Forwards to Anthropic with model = claude-sonnet-4-6│
│                                                         │
│  Admin routes:                                          │
│  POST /admin/chat  → agentic admin bot (password-gated) │
│  GET/POST /admin   → direct KV read/write               │
│  GET /config       → return all KV config (public)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare KV  (CONFIG namespace)                      │
│                                                         │
│  system_prompt         — persona + behavior rules       │
│  knowledge_base        — verified facts (the RAG doc)   │
│  knowledge_base_pending — new facts, overrides KB       │
│  negative_prompt       — false claims to block          │
│  ab_questions          — A/B test questions by persona  │
│  tagline / subtitle / welcome_message / quick_questions │
└─────────────────────────────────────────────────────────┘
```

### Key design decision: KB in system prompt
The full Knowledge Base is injected into the system prompt server-side on every request. The frontend sends **no system field** — the worker owns it entirely. This prevents the model's training data from competing with the KB content (the root cause of hallucination for real public figures).

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Cloudflare Pages (static HTML/CSS/JS — no build step) |
| Backend | Cloudflare Worker (ES modules) |
| Storage | Cloudflare KV |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Deploy | `wrangler` CLI |

---

## Project Structure

```
ethan_expert/
├── index.html          Main site (public chat UI)
├── admin.html          Admin panel (login → Chat Editor + A/B Tester)
├── wrangler.toml       Pages config
├── worker/
│   ├── worker.js       Cloudflare Worker (all server logic)
│   └── wrangler.toml   Worker config (KV binding)
└── README.md
```

---

## Setup

### Prerequisites
- Cloudflare account (free tier works)
- `npm` / `npx` installed
- Anthropic API key

### 1. Clone
```bash
git clone https://github.com/stwagstaff/ethan-expert.git
cd ethan-expert
```

### 2. Create KV namespace
```bash
CLOUDFLARE_API_TOKEN=<your-token> npx wrangler kv namespace create CONFIG
```
Copy the namespace ID into `worker/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CONFIG"
id = "<your-namespace-id>"
```

### 3. Set Worker secrets
```bash
cd worker
echo "sk-ant-..." | npx wrangler secret put ANTHROPIC_API_KEY
echo "yourpassword" | npx wrangler secret put ADMIN_PASSWORD
```

### 4. Deploy Worker
```bash
cd worker
CLOUDFLARE_API_TOKEN=<your-token> npx wrangler deploy
```
Note the worker URL (e.g. `https://ethan-expert-proxy.yoursubdomain.workers.dev`).

Update `PROXY` constant in `index.html` and `admin.html` to your worker URL.

### 5. Deploy Pages
```bash
cd ..
CLOUDFLARE_API_TOKEN=<your-token> npx wrangler pages deploy . \
  --project-name ethan-expert \
  --branch main
```

### 6. Seed initial content
Visit your admin panel and use the Chat Editor to set:
- **system_prompt** — persona and behavior rules
- **knowledge_base** — verified facts about your subject
- **tagline / subtitle / welcome_message** — UI copy

---

## Admin Panel

Access via `/?secret-agent-ethan` on the live site.

### Chat Editor
Conversational interface for editing all config. The admin bot understands natural language:
- *"Change the welcome message to..."*
- *"Add to the knowledge base that..."*
- *"Add a negative prompt entry for..."*

#### Admin Bot Tools
| Tool | Action |
|---|---|
| `save_config` | Save any KV fields directly |
| `append_knowledge` | Add to pending KB queue (fast, no full KB load) |
| `promote_knowledge` | Merge pending queue into main KB |
| `append_negative` | Add a debunked false claim |
| `get_current_config` | Fetch current config |

### A/B Tester
Side-by-side comparison of responses under two different prompts. 6 visitor personas, 10 questions each.

---

## Knowledge Base Priority Order

Highest wins in all conflicts:

```
negative_prompt  ← ABSOLUTE OVERRIDE (false claims, always blocked)
      ↓
knowledge_base_pending  ← recent additions, override KB
      ↓
knowledge_base  ← main verified facts
      ↓
system_prompt  ← behavior / persona only
```

---

## KV Keys Reference

| Key | Type | Purpose |
|---|---|---|
| `system_prompt` | string | Persona + behavior rules. No facts. |
| `knowledge_base` | string | Verified facts. The RAG document. |
| `knowledge_base_pending` | string | Staged additions, override KB. Cleared on promote. |
| `negative_prompt` | string | False claims. Absolute override. |
| `tagline` | string | Small text above site name |
| `subtitle` | string | One-liner under title |
| `welcome_message` | string | First message in chat |
| `quick_questions` | JSON | `{ modeName: ["q1","q2","q3","q4"] }` |
| `ab_questions` | JSON | `{ persona: ["q1",...,"q10"] }` |

---

## Customizing for a Different Subject

This is a general-purpose "expert persona" agent. To adapt it:

1. **Replace the Knowledge Base** — populate `knowledge_base` with verified facts about your subject
2. **Update `system_prompt`** — change the persona name and user mode descriptions
3. **Update `negative_prompt`** — seed with any known false claims about your subject
4. **Update UI copy** — `tagline`, `subtitle`, `welcome_message` via admin panel
5. **Update `SYSTEM_PROMPT_FALLBACK`** in `index.html` (the static fallback, rarely used)

---

## Hallucination Prevention

For real public figures, LLMs have training priors that compete with injected knowledge. This system prevents hallucination through three layers:

1. **Worker-owned system prompt** — frontend sends no `system` field; worker assembles the full context server-side. The model cannot receive a competing system prompt.

2. **KB in system prompt** — the full Knowledge Base is injected directly into the system prompt on every request, not as a message-turn injection. System prompt content is the most reliable grounding mechanism.

3. **Negative prompt** — explicit list of false claims. Appended after the KB. Hard overrides.

---

## Deploy Commands (quick reference)

```bash
TOKEN=<your-cloudflare-api-token>

# Worker
cd worker && CLOUDFLARE_API_TOKEN=$TOKEN npx wrangler deploy

# Pages
CLOUDFLARE_API_TOKEN=$TOKEN npx wrangler pages deploy . \
  --project-name ethan-expert --branch main --commit-dirty=true

# Git
git add -A && git commit -m "message" && git push
```
