# Dumb Agent

A deliberately simple API agent for testing agentic applications. Responds to messages using an LLM (DeepSeek/OpenRouter), authenticates via bearer token, and persists conversation memory to disk.

**Why "dumb"?** No tool use, no planning, no RAG — just identity + memory + LLM response. Intentional simplicity makes it predictable and debuggable for testing external orchestrators and multi-agent systems.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key and auth token
npm start
```

## Configuration (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_TOKEN` | Bearer token for API auth | (required) |
| `LLM_PROVIDER` | Provider name (for display) | `deepseek` |
| `LLM_API_KEY` | Provider API key | (required) |
| `LLM_MODEL` | Model ID | `deepseek-chat` |
| `LLM_BASE_URL` | OpenAI-compatible API base URL | `https://api.deepseek.com/v1` |
| `MAX_MEMORY_ENTRIES` | Max conversation entries in context | `50` |
| `PORT` | Server port | `3000` |

### Provider Examples

**DeepSeek:**
```env
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-xxx
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/v1
```

**OpenRouter:**
```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-xxx
LLM_MODEL=deepseek/deepseek-chat
LLM_BASE_URL=https://openrouter.ai/api/v1
```

## API

### POST /chat

Send a message, get an LLM response.

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token-here" \
  -d '{"message": "Hello!", "sender": "test"}'
```

Response:
```json
{
  "reply": "Hi there! How can I help?",
  "agent": "dumb-agent",
  "timestamp": "2026-03-16T10:00:00.000Z"
}
```

### GET /health

```bash
curl http://localhost:3000/health \
  -H "Authorization: Bearer your-token-here"
```

Response:
```json
{
  "status": "ok",
  "agent": "dumb-agent",
  "provider": "deepseek",
  "uptime": 3600
}
```

## Customizing Identity

Edit these files to change the agent's personality:

- **`soul.md`** — Core behavioral rules and values
- **`identity.md`** — Name, role, communication style

Changes take effect on the next request (no restart needed).

## Memory

Conversation history is automatically appended to `memory.md`. The last N entries (configured by `MAX_MEMORY_ENTRIES`) are injected into each LLM call for context.

To reset memory, delete `memory.md`.

---

<a href="https://www.buymeacoffee.com/phucsystem" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
