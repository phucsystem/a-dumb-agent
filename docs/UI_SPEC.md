# Basic Design (UI Specification)

## 1. Interface Type

**API-only service** — no graphical user interface.

All interaction happens through HTTP REST endpoints. The "UI" for this project is the API contract itself.

## 2. Endpoint Flow

```
                    ┌─────────────┐
                    │  External   │
                    │   Service   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
        POST /chat               GET /health
              │                         │
              ▼                         ▼
        Auth check               Auth check
              │                         │
              ▼                         ▼
        Process msg              Return status
              │
              ▼
        LLM response
              │
              ▼
        Save memory
              │
              ▼
        Return reply
```

## 3. API Interface Specifications

### S-01: POST /chat

**Purpose:** Main conversation endpoint

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <AUTH_TOKEN>
```

**Request Body:**
```json
{
  "message": "string (required) - the user's message",
  "sender": "string (optional) - identifier for the calling system"
}
```

**Success Response (200):**
```json
{
  "reply": "string - the agent's response",
  "agent": "string - agent name from identity",
  "timestamp": "string - ISO 8601 timestamp"
}
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "Unauthorized" }` | Missing/invalid token |
| 400 | `{ "error": "message is required" }` | Missing message field |
| 500 | `{ "error": "LLM request failed" }` | Provider error (no detail field for security) |

### S-02: GET /health

**Purpose:** Liveness check for monitoring

**Request Headers:**
```
Authorization: Bearer <AUTH_TOKEN>
```

**Success Response (200):**
```json
{
  "status": "ok",
  "agent": "string - agent name",
  "provider": "string - current LLM provider",
  "uptime": "number - seconds since start"
}
```

## 4. File-Based "Interface"

Developers interact with the agent's personality and memory through files:

| File | Purpose | Edited By | Format |
|------|---------|-----------|--------|
| `soul.md` | Core personality, values, behavioral rules | Developer (A-02) | Free-form markdown |
| `identity.md` | Name, role, communication style | Developer (A-02) | Free-form markdown |
| `memory.md` | Conversation history | System (auto-append) | Structured markdown entries |
| `.env` | Configuration | Developer (A-02) | KEY=VALUE pairs |

### soul.md Example

```markdown
# Soul

You are helpful and concise. You answer questions directly without unnecessary preamble.
You are honest about what you don't know.
You maintain a friendly but professional tone.
```

### identity.md Example

```markdown
# Identity

**Name:** Dumb Agent
**Role:** Test assistant for agentic application development
**Style:** Concise, direct, slightly playful
```

## 5. Design Rationale

| Decision | Why |
|----------|-----|
| No UI | Testing endpoint — external systems are the consumers |
| JSON request/response | Universal format for service-to-service communication |
| Markdown files for identity | Human-readable, version-controllable, zero infrastructure |
| Append-only memory | Simplest persistence model; debug by reading a file |
| Bearer token (not API key header) | Standard HTTP auth pattern recognized by most HTTP clients |

## 6. Integration Patterns

### cURL Example
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token-here" \
  -d '{"message": "What is your name?", "sender": "test-cli"}'
```

### Webhook Integration
External services can POST to `/chat` as a webhook handler — the agent processes the message and returns a response synchronously.

## Implementation Status

**MVP Completed (2026-03-16)**

- [x] SRD.md reviewed — features match intent
- [x] API contract (request/response shapes) confirmed
- [x] Identity file format (soul.md, identity.md) acceptable
- [x] Memory format (append-only markdown) acceptable
- [x] Auth model (static bearer token with `crypto.timingSafeEqual`) confirmed
- [x] Tech stack: Node.js + Express (decided)
- [x] Startup validation: AUTH_TOKEN and LLM_API_KEY required
- [x] Security: 500 errors don't leak internal details
- [x] LLM client: Handles empty response choices gracefully
