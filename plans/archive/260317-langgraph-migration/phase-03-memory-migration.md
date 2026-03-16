---
phase: 3
title: "Memory Migration"
status: pending
effort: 1.5h
depends_on: [phase-02]
---

# Phase 3: Memory Migration

## Overview
Replace file-based markdown memory (memory.js) with LangGraph's built-in memory systems:
- **Short-term**: MemorySaver checkpointer for per-conversation history (replaces memory/*.md files)
- **Long-term**: InMemoryStore for cross-conversation user knowledge (new capability)

## Context Links
- [plan.md](./plan.md)
- Current: `src/memory.js` (60 lines, file-based markdown)
- [LangGraph Research - Sections 1-2](../reports/langgraph-js-research-20260317.md)

## Key Insights
- **MemorySaver** stores full graph state per `thread_id` -- conversation history persists across calls with same thread_id
- **Current memory format**: Markdown blocks with `---` separators, parsed into `{role, content}` messages. LangGraph checkpointer stores native `BaseMessage[]` -- no parsing needed
- **Conversation scoping**: Current system uses `conversationId` for per-conversation files. Maps directly to LangGraph `thread_id`
- **Legacy /chat endpoint**: Uses single memory.md file (no conversationId). Map to a default thread_id like `"default"`
- **Long-term memory**: New capability. InMemoryStore can store user facts across conversations. Keep simple -- store raw conversation summaries per sender

## Requirements

### Functional
- Conversation history persists across multiple calls with same thread_id (checkpointer)
- Legacy /chat endpoint works with default thread_id
- Webhook endpoint uses conversation_id as thread_id
- MAX_MEMORY_ENTRIES env var maps to message trimming (optional, stretch goal)
- Cross-conversation user facts stored in InMemoryStore (basic implementation)

### Non-functional
- No file I/O for memory (pure in-memory)
- Data lost on restart (acceptable for dev; document upgrade path to Postgres)
- No migration of existing markdown memory files (clean start)

## Architecture

### Short-term Memory (Checkpointer)
```
MemorySaver (in-memory) --> compiled into graph
  |
  +--> thread_id: "default" (for /chat endpoint)
  +--> thread_id: "{conversationId}" (for /webhook endpoint)
```

Each `graph.invoke()` call with same `thread_id` automatically has access to previous messages.

### Long-term Memory (Store)
```
InMemoryStore
  |
  +--> namespace: ["{senderId}", "facts"]
  |     key: "fact_{timestamp}" --> { text: "...", source: "chat" }
  |
  +--> namespace: ["{senderId}", "summary"]
        key: "latest" --> { text: "conversation summary" }
```

Basic implementation: after each conversation turn, store a fact about the user if the agent detects one. Phase 1 of long-term memory -- keep it simple.

### Memory Access in Graph Node
```typescript
// In agent node:
async function agentNode(state, config) {
  const store = config.store;  // InMemoryStore injected
  const senderId = state.sender || "unknown";

  // Retrieve relevant user facts
  const facts = await store.search(
    [senderId, "facts"],
    { query: lastMessage.content, limit: 3 }
  );

  // Inject facts into system prompt
  const systemWithMemory = state.systemPrompt +
    (facts.length ? "\n\nKnown about this user:\n" + facts.map(...) : "");

  // ... call LLM
}
```

**Note**: Semantic search requires an embeddings provider. For simplicity, skip semantic search initially and use `store.list()` to get all facts. Add embeddings later as enhancement.

## Related Code Files

### Files to Modify
- `src/graph.ts` -- Add checkpointer to graph compilation, add store access in agent node

### Files to Create
- `src/memory.ts` -- NEW: InMemoryStore setup + helper functions for long-term memory

### Files to Delete
- `src/memory.js` -- Old file-based memory system
- `memory/` directory -- No longer needed (can keep for reference)
- `memory.md` -- Legacy single-file memory

## Implementation Steps

1. **Create src/memory.ts (long-term store)**
   - Initialize `InMemoryStore` (no embeddings for now)
   - Export `getStore(): InMemoryStore`
   - Export helper: `storeUserFact(store, senderId, fact)` -- puts fact into store
   - Export helper: `getUserFacts(store, senderId, limit?)` -- lists facts for user
   - Keep it under 40 lines

2. **Update src/graph.ts -- Add checkpointer**
   - Import `MemorySaver` from `@langchain/langgraph`
   - In `createGraph()`: `builder.compile({ checkpointer: new MemorySaver() })`
   - Now graph.invoke() with `{ configurable: { thread_id } }` auto-persists conversation

3. **Update src/graph.ts -- Add store access**
   - Import store from memory.ts
   - In agent node: retrieve user facts from store before LLM call
   - After LLM response: optionally store new facts (simple heuristic or skip for v1)
   - Pass store to graph: `builder.compile({ checkpointer, store })`

4. **Update invokeAgent() helper**
   - Accept `threadId` and `sender` parameters
   - Pass `{ configurable: { thread_id: threadId } }` to graph.invoke()
   - Remove manual history loading (checkpointer handles it)

5. **Handle message trimming (stretch goal)**
   - If MAX_MEMORY_ENTRIES is set, implement message trimming in agent node
   - Trim oldest messages from state.messages before LLM call
   - Or use LangGraph's built-in message window if available

6. **Delete old memory files**
   - Remove `src/memory.js`
   - Update docker-compose.yml to remove memory volume mounts (Phase 6)

## Todo
- [ ] Create src/memory.ts with InMemoryStore + helpers
- [ ] Add MemorySaver checkpointer to graph compilation
- [ ] Update agent node to use store for user facts
- [ ] Update invokeAgent() to pass thread_id config
- [ ] Delete src/memory.js
- [ ] Test: multiple calls with same thread_id retain history
- [ ] Test: different thread_ids have separate histories
- [ ] (Stretch) Implement message trimming for MAX_MEMORY_ENTRIES

## Success Criteria
- Two sequential calls with same thread_id: second call sees first message in history
- Two calls with different thread_ids: separate conversation histories
- /chat endpoint uses "default" thread_id
- /webhook endpoint uses conversation_id as thread_id
- Old memory.js is deleted, no file-based memory remains

## Risk Assessment
- **Data loss on restart**: MemorySaver is in-memory only. Document upgrade path: swap `MemorySaver` for `PostgresSaver` when Postgres is available. Same API, just different constructor.
- **Store without embeddings**: `store.search()` won't work without embeddings provider. Use `store.list()` instead for initial implementation. Add embeddings as future enhancement.
- **Memory growth**: No pruning mechanism in dev. For production, checkpointer cleanup needed.
