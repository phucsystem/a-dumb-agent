---
phase: 4
title: "API Layer"
status: pending
effort: 1h
depends_on: [phase-03]
---

# Phase 4: API Layer

## Overview
Update Express routes to invoke the LangGraph graph instead of calling LLM directly. Keep exact same API contract (request/response shapes, auth, endpoints). This is a transparent backend swap.

## Context Links
- [plan.md](./plan.md)
- Current: `src/index.js` (117 lines)

## Requirements

### Functional
- POST /chat -- same request: `{ message, sender }`, same response: `{ reply, agent, timestamp }`
- POST /webhook -- same request/response shape, same agent message skipping logic
- GET /health -- same response, add langgraph version info
- Bearer token auth unchanged
- Error responses unchanged (400, 401, 500)

### Non-functional
- No breaking changes to API consumers
- Backward compatible with existing clients/webhooks

## Architecture

### Route -> Graph Flow
```
POST /chat
  |-> validate request
  |-> loadIdentity()
  |-> graph.invoke({ messages: [HumanMessage(content)], systemPrompt, sender }, { thread_id: "default" })
  |-> extract reply from result.messages[-1].content
  |-> return { reply, agent, timestamp }

POST /webhook
  |-> validate request
  |-> skip if sender_is_agent
  |-> loadIdentity()
  |-> graph.invoke({ messages: [HumanMessage(content)], systemPrompt, sender }, { thread_id: conversationId })
  |-> extract reply from result.messages[-1].content
  |-> return { reply, agent, conversation_id, timestamp }
```

### Key Change
Before: `chat(systemPrompt, history, message)` -- manually pass history
After: `graph.invoke(state, config)` -- history managed by checkpointer via thread_id

## Related Code Files

### Files to Create
- `src/index.ts` -- Migrated from index.js to TypeScript, using graph invocation

### Files to Delete
- `src/index.js` -- Replaced by index.ts

## Implementation Steps

1. **Create src/index.ts**
   - Import Express, dotenv, crypto (same auth logic)
   - Import `loadIdentity` from `./identity.ts`
   - Import `invokeAgent` from `./graph.ts` (or the compiled graph)
   - Keep all env var validation (AUTH_TOKEN, LLM_API_KEY)
   - Keep `authMiddleware` function (same timing-safe comparison)

2. **Migrate POST /chat**
   - Extract `{ message, sender }` from req.body
   - Validate message required
   - Call `invokeAgent(message, { threadId: "default", systemPrompt: loadIdentity(), sender })`
   - Return `{ reply, agent: "dumb-agent", timestamp }`
   - Error handling: catch and return 500

3. **Migrate POST /webhook**
   - Same request parsing as current (event, message, conversation)
   - Same agent message skip logic
   - Extract conversationId, senderName, content
   - Call `invokeAgent(content, { threadId: conversationId, systemPrompt: loadIdentity(), sender: senderName })`
   - Return same response shape with conversation_id

4. **Migrate GET /health**
   - Same response shape
   - Add `langgraph: true` to health response (optional, for observability)

5. **Remove old imports**
   - No more `loadMemory`, `appendMemory` imports
   - No more `chat` from llm.js

6. **Delete src/index.js**

## Todo
- [ ] Create src/index.ts with Express + graph invocation
- [ ] Migrate POST /chat route
- [ ] Migrate POST /webhook route
- [ ] Migrate GET /health route
- [ ] Keep auth middleware identical
- [ ] Delete src/index.js
- [ ] Verify same curl commands work before and after

## Success Criteria
- `curl -X POST /chat -H "Authorization: Bearer $TOKEN" -d '{"message":"hi","sender":"test"}'` returns `{ reply, agent, timestamp }`
- `curl -X POST /webhook -H "Authorization: Bearer $TOKEN" -d '{"message":{"content":"hi","sender_name":"test"},"conversation":{"id":"conv1"}}'` returns reply with conversation_id
- `curl /health -H "Authorization: Bearer $TOKEN"` returns status ok
- 401 for missing/wrong token
- 400 for missing message
- 500 for LLM errors

## Risk Assessment
- **Behavioral change**: Checkpointer means /chat now remembers across requests (it did before too via file, but now in-memory). If agent restarts, memory resets (was persisted before via file). This is a known tradeoff -- document it.
- **Response time**: LangGraph adds small overhead vs direct SDK call. Should be negligible (<50ms).
