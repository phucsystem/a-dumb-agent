---
title: "Migrate to LangGraph.js"
description: "Replace vanilla Express+OpenAI with LangGraph.js StateGraph, checkpointer memory, Store API, and tool calling infrastructure"
status: completed
priority: P1
effort: 8h
branch: feat/langgraph-migration
tags: [langgraph, migration, typescript, memory, tools]
created: 2026-03-17
---

# LangGraph.js Migration Plan

## Goal
Migrate a-dumb-agent from vanilla Express+OpenAI SDK (~180 LOC) to LangGraph.js with TypeScript, gaining: state graph, checkpointer-based memory, cross-conversation Store, tool calling plumbing, and multi-model support. Keep Express API backward-compatible.

## Current State
- 4 JS files (CommonJS): index.js, llm.js, memory.js, identity.js
- File-based markdown memory (per-conversation)
- Direct OpenAI SDK calls with baseURL override (DeepSeek/OpenRouter)
- Express 5 with bearer auth, POST /chat, POST /webhook, GET /health

## Target State
- TypeScript ESM project with LangGraph.js StateGraph
- MemorySaver checkpointer replaces file-based conversation memory
- InMemoryStore for cross-conversation user knowledge (long-term)
- ToolNode infrastructure ready (no tools yet, just plumbing)
- LangChain model adapters (ChatOpenAI with baseURL for DeepSeek/OpenRouter)
- Same Express API surface, same auth, same personality files

## Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| [Phase 1](./phase-01-setup-dependencies.md) | TypeScript + LangGraph.js project setup | 1.5h | completed |
| [Phase 2](./phase-02-core-graph.md) | StateGraph replacing llm.js + identity loading | 2h | completed |
| [Phase 3](./phase-03-memory-migration.md) | Checkpointer (short-term) + Store (long-term) | 1.5h | completed |
| [Phase 4](./phase-04-api-layer.md) | Express routes invoke graph instead of direct LLM | 1h | completed |
| [Phase 5](./phase-05-tool-support.md) | Tool calling infrastructure (plumbing only) | 1h | completed |
| [Phase 6](./phase-06-docker-config.md) | Dockerfile, docker-compose, env vars update | 1h | completed |

## Key Decisions
1. **MemorySaver (dev)** not Postgres -- upgradeable later, YAGNI for now
2. **InMemoryStore (dev)** for long-term memory -- same upgrade path
3. **ChatOpenAI with baseURL** for DeepSeek/OpenRouter compatibility (LangChain adapter)
4. **ESM + TypeScript** -- modern stack, better LangGraph.js integration
5. **No streaming yet** -- keep response model simple, add later if needed
6. **Keep soul.md/identity.md** -- loaded at startup, injected as system message

## Dependencies
- `@langchain/langgraph` (v0.2+)
- `@langchain/openai` (ChatOpenAI adapter)
- `@langchain/core` (tool definitions, messages)
- `zod` (tool schema validation)
- `typescript`, `tsx` (dev tooling)
- Keep: `express`, `dotenv`
- Remove: `openai` (replaced by @langchain/openai)

## Risk Assessment
- **LangGraph.js maturity**: Less mature than Python version; mitigate by keeping graph simple
- **Breaking API**: Mitigate by testing same curl commands before/after
- **Memory loss on restart**: Same as current (file-based lost too if container restarts without volume); MemorySaver is in-memory only -- document this tradeoff

## Research
- [LangGraph.js Memory & Tool Research](../reports/langgraph-js-research-20260317.md)
- [Claude SDK vs LangGraph Comparison](../reports/claude-sdk-vs-langgraph-comparison.md)
- [Agent Frameworks Research](../reports/agent-frameworks-research-2025-2026.md)
