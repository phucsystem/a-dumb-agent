---
phase: 5
title: "Tool Support"
status: pending
effort: 1h
depends_on: [phase-02]
---

# Phase 5: Tool Support

## Overview
Add tool calling infrastructure to the graph. No actual tools yet -- just the plumbing so tools can be added later by defining them in tools.ts and the graph automatically routes to them.

## Context Links
- [plan.md](./plan.md)
- [LangGraph Research - Section 3](../reports/langgraph-js-research-20260317.md)

## Key Insights
- LangGraph tool calling uses `ToolNode` from `@langchain/langgraph/prebuilt`
- Tools defined with `tool()` from `@langchain/core/tools` + zod schemas
- Graph needs conditional edge from agent -> tools (if tool_calls present) or -> END
- `toolsCondition` helper from LangGraph handles routing logic
- Model must have tools bound via `model.bindTools(tools)` for tool calling to work

## Requirements

### Functional
- Graph supports tool calling loop: agent -> tools -> agent -> END
- Empty tools array by default (no tools enabled yet)
- When tools array is empty, graph behaves identically to Phase 2 (agent -> END)
- Tools definable in src/tools.ts, auto-registered with graph

### Non-functional
- Adding a new tool = define in tools.ts + restart. No graph changes needed.
- Tool calling disabled when tools array is empty (no unnecessary LLM tool-calling overhead)

## Architecture

### Updated Graph (with tool support)
```
[START] --> [agent] ---(has tool_calls?)--> [tools] --> [agent]
                    |
                    +--(no tool_calls)----> [END]
```

### tools.ts Structure
```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Example (commented out, for reference):
// const getCurrentTime = tool(
//   () => new Date().toISOString(),
//   {
//     name: "get_current_time",
//     description: "Get the current date and time",
//     schema: z.object({})
//   }
// );

export const tools = [
  // Add tools here. Graph auto-registers them.
];
```

## Related Code Files

### Files to Create
- `src/tools.ts` -- Tool definitions (empty array initially)

### Files to Modify
- `src/graph.ts` -- Add ToolNode, conditional edges, bind tools to model

## Implementation Steps

1. **Create src/tools.ts**
   - Import `tool` from `@langchain/core/tools` and `z` from `zod`
   - Export empty `tools` array
   - Include commented example tool for reference
   - Export type: `export type AgentTool = typeof tools[number]`

2. **Update src/graph.ts -- Conditional tool routing**
   - Import `ToolNode` from `@langchain/langgraph/prebuilt`
   - Import tools from `./tools.ts`
   - If tools.length > 0:
     - Bind tools to model: `model.bindTools(tools)`
     - Add ToolNode: `.addNode("tools", new ToolNode(tools))`
     - Add conditional edge from agent: use `toolsCondition` or custom function
     - Add edge from tools back to agent: `.addEdge("tools", "agent")`
   - If tools.length === 0:
     - Skip ToolNode entirely
     - Direct edge from agent to END (same as Phase 2)
   - This conditional build keeps zero overhead when no tools are defined

3. **Add toolsCondition helper**
   - Import from `@langchain/langgraph/prebuilt` if available
   - Or implement: check if last message has `tool_calls` property with entries
   - Return `"tools"` or `END`

4. **Verify backward compatibility**
   - With empty tools array: graph behaves identically to Phase 2
   - Test that regular chat still works without tool_calls in response

## Todo
- [ ] Create src/tools.ts with empty tools array + commented example
- [ ] Update graph.ts to conditionally add ToolNode and edges
- [ ] Implement/import toolsCondition routing logic
- [ ] Bind tools to model when tools array is non-empty
- [ ] Verify chat works with empty tools (no regression)
- [ ] (Optional) Add one example tool (get_current_time) to validate plumbing

## Success Criteria
- Graph compiles and works with empty tools array (no regression from Phase 4)
- If a tool is uncommented in tools.ts, the graph routes to ToolNode and back
- No extra LLM overhead when tools array is empty (model not bound to tools)
- Adding new tool = define in tools.ts only, no graph.ts changes

## Risk Assessment
- **Tool calling format**: Different LLM providers (DeepSeek vs OpenAI) may handle tool_calls differently. ChatOpenAI adapter should normalize this, but test with actual provider.
- **DeepSeek tool support**: Verify DeepSeek supports function/tool calling via OpenAI-compatible API. If not, tool calling may only work with OpenAI/Claude models.
