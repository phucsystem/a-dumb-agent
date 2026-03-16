# Phase 02: Core Implementation

## Context
- [SRD](../../docs/SRD.md) — FR-01 to FR-07, EP-01, EP-02
- [UI Spec](../../docs/UI_SPEC.md) — API contract
- [plan.md](./plan.md)

## Overview
- **Priority:** P1
- **Status:** Complete
- **Description:** Implement Express server with auth middleware, LLM client, memory read/write, and identity loading

## Requirements
- FR-01: POST /chat endpoint
- FR-02: Bearer token auth
- FR-03: LLM integration (DeepSeek/OpenRouter via OpenAI SDK)
- FR-04: File-based memory (memory.md)
- FR-05: Identity/soul files as system prompt
- FR-06: Context injection (last N memory entries)
- FR-07: GET /health endpoint

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/index.js` | Create | Express server, routes, auth middleware |
| `src/llm.js` | Create | OpenAI-compatible client, chat completion call |
| `src/memory.js` | Create | Read last N entries from memory.md, append new entry |
| `src/identity.js` | Create | Load soul.md + identity.md, build system prompt |

## Architecture

```
Request → auth middleware → route handler
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
              identity.js  memory.js  llm.js
              (load .md)   (read/write) (call API)
```

## Implementation Steps

### 1. `src/identity.js`
- Export `loadIdentity()` function
- Read `soul.md` and `identity.md` from project root (using `fs.readFileSync`)
- Concatenate into single system prompt string
- Handle missing files gracefully (warn + use fallback prompt)

### 2. `src/memory.js`
- Export `loadMemory(maxEntries)` — parse `memory.md`, return last N entries as array of `{role, content}` for OpenAI messages format
- Export `appendMemory(sender, message, reply)` — append timestamped entry to `memory.md`
- Memory entry format in file:
  ```
  ## {ISO timestamp}
  **sender:** {sender}
  **message:** {message}

  **reply:** {reply}

  ---
  ```
- Parse format: split by `---`, extract message/reply pairs
- Return as OpenAI messages: `[{role: "user", content: message}, {role: "assistant", content: reply}]`

### 3. `src/llm.js`
- Import `OpenAI` from `openai` package
- Configure client with `LLM_API_KEY` and `LLM_BASE_URL` from env
- Export `chat(systemPrompt, messages, userMessage)`:
  - Build messages array: `[{role: "system", content: systemPrompt}, ...history, {role: "user", content: userMessage}]`
  - Call `client.chat.completions.create({ model, messages })`
  - Return `response.choices[0].message.content`

### 4. `src/index.js`
- Load dotenv
- Create Express app
- Track `startTime` for uptime calculation

**Auth middleware:**
- Check `Authorization` header matches `Bearer ${AUTH_TOKEN}`
- 401 if missing/invalid

**POST /chat:**
- Validate `message` field in body (400 if missing)
- Load identity → load memory (last N) → call LLM → append memory → return response
- Response: `{ reply, agent: "dumb-agent", timestamp }`
- Wrap in try/catch → 500 with error detail

**GET /health:**
- Return `{ status: "ok", agent: "dumb-agent", provider, uptime }`

**Start server:**
- Listen on `PORT` (default 3000)
- Log startup message

## Todo
- [x] Implement `src/identity.js`
- [x] Implement `src/memory.js`
- [x] Implement `src/llm.js`
- [x] Implement `src/index.js` (server + routes + auth)
- [x] Test manually with curl
- [x] Apply post-review fixes: startup validation, timing-safe comparison, error detail handling, null-safe LLM response

## Success Criteria
- `curl POST /chat` with valid token returns LLM response
- `curl POST /chat` without token returns 401
- `curl POST /chat` without message returns 400
- `curl GET /health` returns status
- `memory.md` is appended after each chat
- Identity files are loaded into system prompt

## Risk Assessment
- LLM API key invalid → 500 error with clear message
- memory.md doesn't exist on first run → create empty file or handle gracefully
- soul.md/identity.md missing → use fallback system prompt

## Security Considerations
- Never log AUTH_TOKEN or LLM_API_KEY
- Never include API key in error responses
- Validate request body to prevent injection
