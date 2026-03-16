# Lean MVP Analysis: Dumb Agent

## Problem Statement

Developers building agentic applications need a lightweight, predictable test endpoint — a "dumb agent" that accepts messages via API, responds using an LLM (DeepSeek/OpenRouter), and persists conversation memory to disk. It must be simple enough to reason about, yet real enough to exercise agentic workflows (auth, memory, identity, multi-turn conversation).

The key insight: **intentional simplicity is the feature**. No tool use, no planning loops, no RAG — just identity + memory + LLM response. This makes it ideal for testing external orchestrators, webhook integrations, and multi-agent communication patterns.

## Target Users (→ IPA User Roles)

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Agentic App Developer | Devs building multi-agent systems | Predictable test agent with real LLM responses |
| External Service | Systems sending webhooks/requests | Stable API with token auth and consistent behavior |

## MVP Features (→ IPA Feature List FR-xx)

| Priority | Feature | User Value | Assumption |
|----------|---------|------------|------------|
| P1 | FR-01: API endpoint (POST /chat) | External systems can send messages and get responses | REST is sufficient, no streaming needed for v1 |
| P1 | FR-02: Bearer token auth | Prevent unauthorized access | Single static token is enough |
| P1 | FR-03: LLM response (DeepSeek/OpenRouter) | Real AI responses, not canned | OpenAI-compatible API format works for both providers |
| P1 | FR-04: File-based memory (memory.md) | Agent remembers past interactions | Append-only markdown is sufficient for test use |
| P1 | FR-05: Identity/Soul (static .md files) | Define agent personality via system prompt | Static files loaded at startup, no hot-reload needed |
| P2 | FR-06: Conversation context injection | Agent uses memory in responses | Last N messages or full memory injected into prompt |
| P2 | FR-07: Health check endpoint (GET /health) | External systems verify agent is alive | Simple 200 OK response |
| P3 | FR-08: Multiple identity profiles | Switch agent personality | Nice-to-have, defer if scope creeps |

## Implementation Phases (Estimated)

| Phase | Focus | Key Features | Effort |
|-------|-------|--------------|--------|
| 1 | Core | FR-01 to FR-05 (API + Auth + LLM + Memory + Identity) | S |
| 2 | Polish | FR-06 to FR-07 (Context injection + Health check) | S |

Total: ~1 day for a focused developer. Intentionally small.

## Plan Structure Preview

```
plans/{date}-dumb-agent-mvp/
├── plan.md
├── phase-01-core/
│   └── core.md    # API server + auth + LLM + memory + identity
└── phase-02-polish/
    └── core.md    # Context injection + health check
```

## MVP Screens (→ IPA Screen List S-xx)

No UI. API-only service.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /chat | POST | Send message, get LLM response |
| /health | GET | Liveness check |

## Data Entities (→ IPA Entity List E-xx)

| Entity | Description | Storage | Key Fields |
|--------|-------------|---------|------------|
| E-01: Memory | Conversation history | `memory.md` (local file) | timestamp, role, content |
| E-02: Identity | Agent personality | `soul.md` / `identity.md` (static files) | system prompt, name, traits |
| E-03: Config | API keys, token, provider | `.env` or `config.json` | api_key, auth_token, provider, model |

## API Shape (Draft)

```
POST /chat
Headers: Authorization: Bearer <LONG_LIVED_TOKEN>
Body: { "message": "Hello agent", "sender": "external-system" }
Response: { "reply": "...", "agent": "dumb-agent" }
```

## Tech Decisions (→ IPA Key Decisions D-xx)

| Decision | Context | Chosen | Rationale |
|----------|---------|--------|-----------|
| D-01: Runtime | Need simple HTTP server | Node.js (Express) or Python (FastAPI) | TBD by user preference — both work well |
| D-02: LLM Provider | DeepSeek or OpenRouter | OpenAI-compatible SDK | Both expose OpenAI-compatible APIs, single client works |
| D-03: Memory format | Need simple persistence | Markdown file (append-only) | Human-readable, easy to inspect/debug, no DB needed |
| D-04: Auth | Prevent unauthorized access | Static bearer token from env | Simplest possible — no OAuth, no JWT rotation |
| D-05: Identity | Define agent personality | Static .md files as system prompt | No database, no admin UI — just edit files |

## User Flow (→ IPA Screen Flow)

```
External System → POST /chat (with bearer token)
                      ↓
                 Validate token
                      ↓
                 Load identity (soul.md + identity.md)
                      ↓
                 Load memory (memory.md)
                      ↓
                 Build prompt (identity + memory + new message)
                      ↓
                 Call LLM (DeepSeek/OpenRouter)
                      ↓
                 Append to memory.md
                      ↓
                 Return response ← External System
```

## Nice-to-Have (Post-MVP)

- FR-08: Multiple identity profiles (switch via header/param)
- Streaming responses (SSE)
- Memory summarization (when memory.md gets too large)
- Webhook callback mode (push response to URL instead of sync return)
- Rate limiting
- Docker container for easy deployment

## Key Assumptions to Validate

1. **Append-only memory is sufficient** — Validate: does memory.md grow too large for context window? May need truncation/summarization later
2. **Single static token is secure enough** — Validate: acceptable for test use, not production
3. **Sync request/response is enough** — Validate: external systems don't need async/webhook callbacks
4. **No streaming needed** — Validate: test scenarios work with full response, not chunks

## Out of Scope

- Web UI / admin panel
- Tool use / function calling
- Multi-agent orchestration (this IS the dumb endpoint)
- Database / structured storage
- User management / multi-tenant
- Streaming responses
- Rate limiting / throttling
- Deployment / infrastructure

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory file grows unbounded | Context window overflow, slow responses | Add max-memory config, truncate oldest entries |
| API key exposed in config | Security breach | Use .env, never commit to git |
| LLM provider downtime | Agent unresponsive | Support both DeepSeek + OpenRouter, fallback |

## GATE 1: Scope Validation

Before proceeding to `/ipa:spec`, complete this checklist:

- [ ] Confirmed: this is for **testing agentic apps**, not production use
- [ ] Confirmed: API-only, no UI needed
- [ ] Confirmed: single token auth is acceptable
- [ ] Confirmed: file-based memory is acceptable
- [ ] Tech stack decided (Node.js or Python)
- [ ] MVP scope ≤ 2 phases ✅

**⚠️ Scope is intentionally minimal. Resist adding features.**

## Next Step

After GATE 1 validation:
→ Run `/ipa:spec` to generate SRD.md + UI_SPEC.md
→ Or jump straight to `/plan` given the simplicity
