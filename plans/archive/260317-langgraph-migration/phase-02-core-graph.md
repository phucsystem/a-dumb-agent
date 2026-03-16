---
phase: 2
title: "Core Graph"
status: pending
effort: 2h
depends_on: [phase-01]
---

# Phase 2: Core Graph

## Overview
Build the LangGraph StateGraph that replaces `llm.js`. The graph has a single "agent" node that calls the LLM with system prompt (from identity files) and conversation history. This is the heart of the migration.

## Context Links
- [plan.md](./plan.md)
- Current: `src/llm.js` (29 lines, direct OpenAI call)
- Current: `src/identity.js` (33 lines, soul.md + identity.md loader)
- [LangGraph Research - Section 5](../reports/langgraph-js-research-20260317.md)

## Key Insights
- LangGraph uses `MessagesAnnotation` for conversation state -- messages array with reducer that appends
- `ChatOpenAI` from `@langchain/openai` supports `baseURL` override, directly replacing our OpenAI SDK usage for DeepSeek/OpenRouter
- Identity (system prompt) injected as first message in the messages array, not as separate state
- Graph compiled with checkpointer handles conversation threading via `thread_id` in config

## Requirements

### Functional
- StateGraph with single "agent" node that calls LLM
- System prompt loaded from soul.md + identity.md (same logic as current identity.js)
- LLM model configurable via env vars (LLM_MODEL, LLM_BASE_URL, LLM_API_KEY)
- Graph accepts user message, returns assistant reply
- Conversation history managed by graph state (MessagesAnnotation)

### Non-functional
- Graph must be compilable with or without checkpointer (Phase 3 adds checkpointer)
- Model adapter must support DeepSeek and OpenRouter via baseURL override

## Architecture

### Graph Definition (graph.ts)
```
[START] --> [agent] --> [END]
```

Single-node graph for now. Phase 5 adds conditional edge to tool node.

### State Schema
```typescript
// Uses MessagesAnnotation from @langchain/langgraph
// Extends with optional fields:
{
  messages: BaseMessage[]   // conversation history (built-in reducer: append)
  systemPrompt: string      // loaded from identity files
  sender: string            // user identifier
  conversationId: string    // thread identifier
}
```

### Model Setup
```typescript
// ChatOpenAI supports baseURL override -- works for DeepSeek/OpenRouter
new ChatOpenAI({
  modelName: process.env.LLM_MODEL || "deepseek-chat",
  openAIApiKey: process.env.LLM_API_KEY,
  configuration: {
    baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1"
  }
})
```

## Related Code Files

### Files to Create
- `src/graph.ts` -- StateGraph definition, agent node, model setup
- `src/identity.ts` -- Migrated from identity.js to TypeScript

### Files to Delete
- `src/llm.js` -- Replaced by graph.ts
- `src/identity.js` -- Replaced by identity.ts

## Implementation Steps

1. **Migrate identity.js to identity.ts**
   - Same logic: read soul.md + identity.md, combine into system prompt
   - Use `import fs from 'node:fs'` and `import path from 'node:path'`
   - Export `loadIdentity(): string`
   - Keep fallback behavior for missing files

2. **Create src/graph.ts**
   - Define state annotation extending MessagesAnnotation:
     ```typescript
     const AgentAnnotation = Annotation.Root({
       ...MessagesAnnotation.spec,
       systemPrompt: Annotation<string>(),
     });
     ```
   - Create model instance (ChatOpenAI with env var config)
   - Define agent node function:
     - Prepend system prompt as SystemMessage to messages
     - Call model.invoke(messages)
     - Return `{ messages: [response] }`
   - Build graph:
     - `new StateGraph(AgentAnnotation)`
     - `.addNode("agent", agentNode)`
     - `.addEdge(START, "agent")`
     - `.addEdge("agent", END)`
   - Export a `createGraph()` function that accepts optional checkpointer
   - Export the compiled graph instance

3. **Create graph invocation helper**
   - Export `async function invokeAgent(message: string, config: { threadId: string, systemPrompt: string }): Promise<string>`
   - Wraps graph.invoke() with proper config and state
   - Extracts assistant reply text from result messages
   - This is what Express routes will call (Phase 4)

4. **Verify graph works standalone**
   - Write a quick test script (not committed) that imports graph and sends a message
   - Confirm model responds via DeepSeek/OpenRouter baseURL

## Todo
- [ ] Create src/identity.ts (migrate from identity.js)
- [ ] Create src/graph.ts with StateGraph + agent node
- [ ] Configure ChatOpenAI with baseURL override for DeepSeek/OpenRouter
- [ ] Export createGraph() and invokeAgent() helper
- [ ] Delete src/llm.js and src/identity.js
- [ ] Verify graph invocation returns LLM response

## Success Criteria
- `invokeAgent("hello", { threadId: "test", systemPrompt: "..." })` returns LLM response
- System prompt from soul.md/identity.md is used in LLM call
- Model uses LLM_BASE_URL, LLM_API_KEY, LLM_MODEL env vars
- No direct OpenAI SDK dependency

## Risk Assessment
- **ChatOpenAI baseURL**: Verify `@langchain/openai` ChatOpenAI supports `configuration.baseURL` for non-OpenAI providers. If not, use `ChatOpenAI({ configuration: { basePath: ... } })` or raw `OpenAI` from langchain
- **Message format**: DeepSeek/OpenRouter may have slight message format differences from OpenAI; LangChain adapter should handle this transparently
