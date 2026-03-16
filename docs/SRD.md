# System Requirement Definition (SRD)

## 1. System Overview

**Project:** Dumb Agent
**Purpose:** Lightweight API-only agent for testing agentic application workflows. Accepts messages via REST API, responds using LLM (DeepSeek/OpenRouter), persists conversation memory to local disk. Intentionally simple — no tools, no planning, no RAG.

**Design Philosophy:** Intentional simplicity is the feature. The agent is "dumb" by design to serve as a predictable, debuggable test endpoint for external orchestrators and multi-agent systems.

## 2. Actors (User Roles)

| ID | Actor | Description |
|----|-------|-------------|
| A-01 | External Service | Automated system sending messages via API (orchestrators, webhooks, other agents) |
| A-02 | Developer | Human configuring identity files, API keys, and inspecting memory |

## 3. Functional Requirements (FR-xx)

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| FR-01 | Chat Endpoint | P1 | POST /chat accepts a message and returns an LLM-generated response |
| FR-02 | Bearer Token Auth | P1 | All endpoints require valid `Authorization: Bearer <token>` header; token is a static long-lived value from environment config |
| FR-03 | LLM Integration | P1 | Call DeepSeek or OpenRouter API using OpenAI-compatible SDK; provider and model configurable via env |
| FR-04 | File-Based Memory | P1 | Append each interaction (user message + agent reply) to `memory.md` on local disk with timestamps |
| FR-05 | Identity/Soul Files | P1 | Load static markdown files (`soul.md`, `identity.md`) at request time as system prompt context |
| FR-06 | Context Injection | P2 | Inject recent memory entries into LLM prompt so agent has conversation continuity; configurable max context window |
| FR-07 | Health Check | P2 | GET /health returns 200 OK with basic status info |

## 4. API Endpoints

### EP-01: POST /chat

**Auth:** Bearer token required

**Request:**
```json
{
  "message": "Hello agent",
  "sender": "external-system"
}
```

**Response (200):**
```json
{
  "reply": "Hi! How can I help you today?",
  "agent": "dumb-agent",
  "timestamp": "2026-03-16T10:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` — missing or invalid token
- `400 Bad Request` — missing `message` field
- `500 Internal Server Error` — LLM call failed; error message omitted to prevent information leakage
  ```json
  { "error": "LLM request failed" }
  ```

### EP-02: GET /health

**Auth:** Bearer token required

**Response (200):**
```json
{
  "status": "ok",
  "agent": "dumb-agent",
  "provider": "deepseek",
  "uptime": 3600
}
```

## 5. Screen List (S-xx)

No UI screens. API-only service.

| ID | Endpoint | Method | Description |
|----|----------|--------|-------------|
| S-01 | /chat | POST | Main conversation endpoint |
| S-02 | /health | GET | Liveness/readiness check |

## 6. Entity List (E-xx)

| ID | Entity | Storage | Description |
|----|--------|---------|-------------|
| E-01 | Memory | `memory.md` (local file) | Append-only conversation log with timestamps, roles, and content |
| E-02 | Soul | `soul.md` (static file) | Core personality traits, values, behavioral guidelines |
| E-03 | Identity | `identity.md` (static file) | Name, role description, communication style |
| E-04 | Config | `.env` file | API keys, auth token, provider selection, model name |

### E-01: Memory Format (memory.md)

```markdown
## 2026-03-16T10:00:00Z
**sender:** external-system
**message:** Hello agent

**reply:** Hi! How can I help you today?

---
```

### E-04: Config (.env)

```env
AUTH_TOKEN=your-long-lived-token-here
LLM_PROVIDER=deepseek          # or "openrouter"
LLM_API_KEY=sk-xxx
LLM_MODEL=deepseek-chat        # or openrouter model ID
LLM_BASE_URL=https://api.deepseek.com/v1
MAX_MEMORY_ENTRIES=50           # max conversation entries in context
PORT=3000
```

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Response time ≤ LLM latency + 500ms overhead |
| NFR-02 | Security | Auth token never logged or exposed in responses; token comparison uses `crypto.timingSafeEqual` to prevent timing attacks |
| NFR-03 | Security | `.env` file excluded from version control; AUTH_TOKEN and LLM_API_KEY validated at startup |
| NFR-04 | Reliability | Graceful error handling when LLM provider is down; 500 errors don't expose internal details |
| NFR-05 | Observability | Log each request (sender, timestamp) to stdout |
| NFR-06 | Simplicity | Minimal-file implementation (4 modules) with no external orchestration |
| NFR-07 | Portability | Node.js 14+ with native `crypto` module; no heavy dependencies |

## 8. Key Decisions (D-xx)

| ID | Decision | Chosen | Rationale |
|----|----------|--------|-----------|
| D-01 | LLM SDK | OpenAI-compatible client | Both DeepSeek and OpenRouter expose OpenAI-compatible APIs |
| D-02 | Memory format | Markdown append-only | Human-readable, easy to inspect, no DB needed |
| D-03 | Auth mechanism | Static bearer token | Simplest possible for test use; no JWT, no OAuth |
| D-04 | Identity loading | Read .md files per request | No caching needed for test use; allows live editing |
| D-05 | Runtime | Node.js + Express | Lightweight, single-file server with native crypto module for timing-safe auth |

## 9. Out of Scope

- Web UI / admin panel
- Tool use / function calling
- Multi-agent orchestration logic
- Database / structured storage
- User management / multi-tenant
- Streaming responses (SSE/WebSocket)
- Rate limiting
- Deployment infrastructure
- Authentication beyond static token

## 10. Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R-01 | Memory file grows unbounded | Context window overflow | MAX_MEMORY_ENTRIES config, truncate oldest |
| R-02 | API key in .env committed to git | Security breach | .gitignore, .env.example template |
| R-03 | LLM provider downtime | Agent unresponsive | Support provider switching via config |

## 11. Request Flow

```
External Service
      │
      ▼
  POST /chat
  (Bearer token)
      │
      ▼
  Validate Token ──── 401 Unauthorized
      │
      ▼
  Validate Body ───── 400 Bad Request
      │
      ▼
  Load soul.md + identity.md
      │
      ▼
  Load memory.md (last N entries)
      │
      ▼
  Build prompt:
    [system: soul + identity]
    [history: memory entries]
    [user: new message]
      │
      ▼
  Call LLM API ────── 500 Error
      │
      ▼
  Append to memory.md
      │
      ▼
  Return { reply, agent, timestamp }
```
