---
phase: 1
title: "Setup & Dependencies"
status: pending
effort: 1.5h
---

# Phase 1: Setup & Dependencies

## Overview
Convert project from CommonJS JavaScript to ESM TypeScript. Install LangGraph.js and LangChain packages. Establish new project structure.

## Context Links
- [plan.md](./plan.md)
- [LangGraph.js Research](../reports/langgraph-js-research-20260317.md)

## Requirements

### Functional
- TypeScript compilation with tsx (no build step for dev, tsc for production)
- ESM module system (`"type": "module"` in package.json)
- All LangGraph.js + LangChain dependencies installed

### Non-functional
- Dev experience: `npm run dev` uses tsx for hot-reload-like DX
- Production: `npm run build` compiles to dist/, `npm start` runs compiled JS

## Architecture

### New Project Structure
```
src/
  index.ts          # Express server (migrated from index.js)
  graph.ts          # LangGraph StateGraph definition (NEW)
  identity.ts       # Identity loader (migrated from identity.js)
  memory.ts         # DELETED -- replaced by LangGraph checkpointer
  llm.ts            # DELETED -- replaced by LangChain model in graph.ts
  tools.ts          # Tool definitions placeholder (NEW, Phase 5)
  types.ts          # Shared TypeScript types (NEW)
dist/               # Compiled output (gitignored)
tsconfig.json       # TypeScript config (NEW)
```

## Related Code Files

### Files to Modify
- `package.json` -- add dependencies, change scripts, set `"type": "module"`

### Files to Create
- `tsconfig.json`
- `src/types.ts`

### Files to Delete (later phases)
- `src/llm.js` -- Phase 2
- `src/memory.js` -- Phase 3

## Implementation Steps

1. **Update package.json**
   - Set `"type": "module"`
   - Update `"main"` to `"dist/index.js"`
   - Add scripts:
     - `"dev": "tsx watch src/index.ts"`
     - `"build": "tsc"`
     - `"start": "node dist/index.js"`
   - Add dependencies:
     - `@langchain/langgraph` (v0.2+)
     - `@langchain/openai` (for ChatOpenAI adapter)
     - `@langchain/core` (base message types, tool abstractions)
     - `zod` (tool schema validation, used by LangChain)
   - Add devDependencies:
     - `typescript` (~5.x)
     - `tsx` (for dev mode)
     - `@types/express` (Express types)
     - `@types/node`
   - Remove dependencies:
     - `openai` (replaced by @langchain/openai)

2. **Create tsconfig.json**
   - Target: ES2022
   - Module: NodeNext / ESNext
   - moduleResolution: NodeNext
   - outDir: dist
   - rootDir: src
   - strict: true
   - esModuleInterop: true
   - skipLibCheck: true

3. **Create src/types.ts**
   - Define `AgentState` interface extending MessagesAnnotation
   - Define `ChatRequest` and `WebhookRequest` types for Express routes
   - Define `AgentConfig` type for graph configuration

4. **Run npm install** and verify no dependency conflicts

5. **Verify TypeScript compiles** with `npx tsc --noEmit`

## Todo
- [ ] Update package.json (type, scripts, dependencies)
- [ ] Create tsconfig.json
- [ ] Create src/types.ts with state/request types
- [ ] Run npm install
- [ ] Verify tsc compiles without errors
- [ ] Add dist/ to .gitignore

## Success Criteria
- `npm install` succeeds with all LangGraph packages
- `npx tsc --noEmit` passes (even if src files are stubs)
- Project structure matches architecture above
- ESM imports work (`import { StateGraph } from "@langchain/langgraph"`)

## Risk Assessment
- **Version conflicts**: LangChain packages have interdependencies; pin versions from same release window
- **ESM migration**: Some packages may need special import handling; tsx handles this well in dev
