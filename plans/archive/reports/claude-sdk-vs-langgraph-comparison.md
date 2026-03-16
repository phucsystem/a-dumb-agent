# Claude Agent SDK vs LangGraph.js: Deep Technical Comparison

**Research Date:** March 17, 2026
**Status:** Production comparison of two major agent frameworks
**Summary:** Both frameworks are production-ready but serve fundamentally different use cases. Claude Agent SDK excels at sophisticated single agents with automatic context management. LangGraph dominates multi-agent orchestration with advanced state management. They complement rather than compete—LangGraph nodes can execute Claude Agent SDK calls.

---

## 1. Architecture & Design Philosophy

### Claude Agent SDK

**Design Pattern:** Agent harness + tool executor
**Model:** Code-first, linear agent loop
**Execution:** Single agent autonomously handles tool execution across multiple turns

- **Architecture:** Implements a battle-tested agent loop powering Claude Code
  - Automatic context compaction as conversation grows
  - Built-in turn management (Claude outputs → tools execute → results feed back → repeat)
  - Maintains conversational state across sessions
  - Persistent context with automatic summarization for long-running tasks

- **Philosophy:** "Give Claude full agency with built-in tools"
  - Minimal boilerplate—specify allowed tools and let Claude orchestrate
  - Not designed for conditional logic or complex workflows
  - Optimized for code-centric tasks (file operations, command execution, editing)

**Strengths:**
- Proven infrastructure (powers Claude Code used by thousands daily)
- Automatic context window management prevents model from running out of context
- Zero-latency MCP server execution (in-process)
- Sessions persist full state, enabling multi-turn experiences seamlessly

**Limitations:**
- Tightly coupled to Claude models only
- No built-in support for conditional branching or parallel execution
- Difficult to orchestrate multiple independent agents
- Limited observability compared to frameworks with explicit node/edge graphs

### LangGraph.js

**Design Pattern:** Graph-based state machine
**Model:** Declarative graph composition with typed state
**Execution:** Multi-node workflows with explicit control flow

- **Architecture:** Three primitives
  - **State:** Shared TypeScript-typed data structure (channel-based updates)
  - **Nodes:** Pure functions (state → updated state)
  - **Edges:** Functions defining routing logic (conditional or unconditional)

- **Philosophy:** "Orchestration is first-class; model is one node in the graph"
  - Graph-first mental model forces explicit control flow
  - State machines enable conditional logic, loops, human-in-the-loop
  - Model-agnostic (Claude, OpenAI, Cohere, Gemini in same graph)
  - Time-travel debugging built in (replay to any checkpoint)

**Strengths:**
- Explicit control flow eliminates hidden behavior surprises
- Typed state prevents data corruption across turns
- Supports parallel execution (multiple nodes concurrently)
- Checkpointing enables fault recovery and debugging
- Multi-model in single workflow (mix Claude + GPT-4 + Gemini)

**Limitations:**
- Boilerplate: Must define StateAnnotation, nodes, edges explicitly
- Steeper learning curve (graph thinking is different from procedural code)
- LangGraph.js less mature than Python version (noted production concerns)
- Requires careful edge design to avoid inefficient context cycles

---

## 2. Developer Experience

### Claude Agent SDK: TypeScript/Python

**API Design:**
```typescript
// Minimal, async-generator-based
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits"
  }
})) {
  console.log(message);
}
```

**Developer Experience:**
- ✅ Immediate productivity: 5-minute setup, agents working instantly
- ✅ Minimal API surface: `query()`, `ClaudeAgentOptions`, streaming messages
- ✅ TypeScript auto-completion for tool names and options
- ✅ Python and TypeScript SDKs feature-parity (rare for agent frameworks)
- ❌ Limited debugging: Can't inspect intermediate decisions
- ❌ Single-threaded execution: Sequential tool calls only

**Learning Curve:** ~2 hours for first agent, 1 week to mastery
**Documentation:** Good coverage but sparse for edge cases
**IDE Support:** Strong (type-safe options, good errors)

### LangGraph.js: TypeScript-first

**API Design:**
```typescript
// Graph-centric, StateGraph-based
import { StateGraph, START, END, StateAnnotation } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: (current = [], update) => current.concat(update),
  }),
});

const graph = new StateGraph(StateAnnotation)
  .addNode("agent", async (state) => {
    // Call Claude or any LLM
    return { messages: [...state.messages, response] };
  })
  .addNode("tools", async (state) => {
    // Execute tools based on agent output
  })
  .addEdge(START, "agent")
  .addConditionalEdges("agent", (state) => {
    // Routing logic: return node name
    if (requiresTools) return "tools";
    return END;
  })
  .addEdge("tools", "agent")
  .compile();

const result = await graph.invoke({ messages: [] });
```

**Developer Experience:**
- ✅ Explicit control flow visible in code
- ✅ Full TypeScript typing for state mutations (prevents bugs)
- ✅ Powerful debugging via LangGraph Studio (visual execution trace)
- ✅ Checkpointing built-in (pause/resume/fork workflows)
- ✅ Streaming middleware for real-time UI updates
- ❌ Verbose setup: Simple agents require 50+ lines of boilerplate
- ❌ Higher cognitive load: Must think in graphs, not procedures
- ❌ LangGraph.js bugs: JSON error parsing issues, inconsistent error handling vs Python

**Learning Curve:** ~1 day for basic graph, 3-4 weeks for production patterns
**Documentation:** Comprehensive reference docs but examples favor Python
**IDE Support:** Good TypeScript support, LangGraph Studio is key differentiator
**Production Concerns:** LangGraph.js lag behind Python; GitHub issue #850 (Feb 2025) asks "Is langgraphjs production ready?"

---

## 3. Tool/MCP Integration

### Claude Agent SDK

**Built-in Tools:**
- Read, Write, Edit files
- Bash (shell commands, git, cron jobs)
- Glob (file pattern matching)
- Grep (regex search)
- WebSearch (real-time web access)
- WebFetch (parse HTML/PDF/JSON)
- AskUserQuestion (multiple-choice prompts)

**MCP Integration:**
- Runs MCP servers in-process (zero-latency tool calls)
- Supports stdio transport (local processes) and HTTP
- Configuration via `mcpServers` option
- MCP tool search: dynamically loads tools on-demand instead of preloading all (important for large tool inventories)

**Example:**
```typescript
for await (const message of query({
  prompt: "Open example.com and describe it",
  options: {
    mcpServers: {
      playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
    }
  }
})) {
  console.log(message);
}
```

**Strengths:**
- Simpler MCP integration (no explicit tool definition needed)
- In-process execution avoids network latency
- Automatic tool execution inside agent loop

**Limitations:**
- No OAuth/auth flow handling (you manage tokens)
- 60-second timeout on server connections (configurable but inflexible for slow services)
- Tool definitions consume significant context when many tools present

### LangGraph.js

**Tool Integration:**
- No built-in tools; must use LangChain tools or custom functions
- Tool calling via `ToolNode` (handles structured tool execution)
- Full control: implement custom tool calling logic

**MCP Integration:**
- Not native; requires wrapper to bridge MCP servers to LangChain tools
- Typically used via LangChain's `Tool` abstraction
- Requires explicit tool registration in state

**Example:**
```typescript
import { tool } from "@langchain/core/tools";

const readFileTool = tool(
  async ({ path }) => {
    return fs.readFileSync(path, "utf-8");
  },
  {
    name: "read_file",
    description: "Read file contents",
    schema: z.object({ path: z.string() })
  }
);

// In graph node:
const tools = [readFileTool];
const toolNode = new ToolNode(tools);
graph.addNode("tools", toolNode);
```

**Strengths:**
- Fine-grained control over tool execution
- Can mix Claude, OpenAI, and other provider tools in same graph
- Extensible (build custom tool wrappers)

**Limitations:**
- Boilerplate: Define tools as Zod schemas + functions
- Less ergonomic than SDK built-ins
- MCP support weaker than Claude Agent SDK
- Tool calling logic must be implemented per LLM (Claude vs OpenAI differ)

**Clear Winner: Claude Agent SDK** for rapid tool integration. LangGraph excels for heterogeneous tool ecosystems.

---

## 4. State Management & Memory

### Claude Agent SDK

**Session Management:**
- Implicit session state: Full conversation history maintained by SDK
- Auto-compaction: As context window fills, old exchanges compressed
- Session resumption: Capture `session_id` from first query, pass to `resume` option in subsequent queries
- Persistent file system: All file operations persist across turns

**Example:**
```typescript
let sessionId: string;

// First query
for await (const msg of query({
  prompt: "Read auth.py",
  options: { allowedTools: ["Read"] }
})) {
  if (msg.type === "system" && msg.subtype === "init") {
    sessionId = msg.session_id;
  }
}

// Resume with full context
for await (const msg of query({
  prompt: "Now find all callers",
  options: { resume: sessionId }
})) {
  console.log(msg);
}
```

**Strengths:**
- Zero-overhead sessions: Context compaction automatic
- File-based memory: Edits, reads persist naturally
- Multi-turn resilience: Model doesn't lose context mid-task

**Limitations:**
- No explicit checkpointing (can't rewind to middle of session)
- Limited query into session state (opaque after session_id assigned)
- Auto-compaction sometimes loses low-priority context unpredictably

### LangGraph.js

**Checkpoint System:**
- Explicit savepoints: Every graph step creates checkpoint
- Thread-based organization: `thread_id` groups checkpoint sequence
- Stateful replay: `fork()` to branch from any checkpoint
- Persistence: Pluggable checkpointer (PostgreSQL, Snowflake, memory, custom)

**Example:**
```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = stateGraph.compile({ checkpointer });

// Normal execution
const threadId = "user-123";
const result = await graph.invoke(
  { messages: [{ role: "user", content: "fix bug" }] },
  { configurable: { thread_id: threadId } }
);

// Replay to step 3
const history = await graph.getState({
  configurable: { thread_id: threadId }
});

// Rewind to any checkpoint
await graph.invoke(
  { /* state override */ },
  {
    configurable: {
      thread_id: threadId,
      checkpoint_ts: history.checkpoint_ts // rewind to specific time
    }
  }
);
```

**Strengths:**
- Time-travel debugging: Inspect and rewind any step
- Durable execution: Resume from failure point
- Human-in-the-loop: Modify state at any checkpoint
- Multi-session support: Independent `thread_id` per conversation

**Limitations:**
- Requires explicit checkpointer setup (memory/database)
- Checkpoint overhead: Scales with state size × number of steps
- Complex state schemas can bloat checkpoint storage

**Clear Winner: LangGraph.js** for advanced state patterns. Claude Agent SDK sufficient for most single-agent cases.

---

## 5. Multi-Agent Support

### Claude Agent SDK

**Agent Definition:**
- Subagents: Spawn specialized agents from parent agent
- Defined in options: `agents: { "code-reviewer": AgentDefinition(...) }`
- Tool-based: Agents invoked via `Agent` tool

**Example:**
```typescript
for await (const message of query({
  prompt: "Use code-reviewer to review src/",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Agent"],
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer",
        prompt: "Review for security, performance, and style",
        tools: ["Read", "Glob", "Grep"]
      }
    }
  }
})) {
  console.log(message);
}
```

**Strengths:**
- Simple one-liner subagent definition
- Automatic delegation: Parent agent decides when to call subagent
- Unified permissions model: Control subagent tool access

**Limitations:**
- Hierarchical only (parent→child, not peer-to-peer)
- No explicit handoffs (sequential delegation via tool calls)
- Limited coordination: Subagents can't see each other's outputs
- Parent agent must explicitly invoke subagent

### LangGraph.js

**Multi-Agent Orchestration:**
- Graph-based: Each agent is a node
- Router node: Supervisor decides which agent handles next step
- Handoff strategies: Sequential, conditional, parallel

**Example: Supervisor Pattern**
```typescript
const supervisorNode = new RunnableSequence({
  steps: [
    {
      prompt: PromptTemplate.fromTemplate(
        "Which agent? researcher, writer, editor. Return name only."
      ),
      llm: model,
      outputParser: new StringOutputParser()
    }
  ]
});

graph
  .addNode("supervisor", supervisorNode)
  .addNode("researcher", researcherAgent)
  .addNode("writer", writerAgent)
  .addNode("editor", editorAgent)
  .addConditionalEdges(
    "supervisor",
    (state) => state.next_agent, // returns "researcher", "writer", etc
    {
      researcher: "researcher",
      writer: "writer",
      editor: "editor",
      END: END
    }
  )
  .addEdge(["researcher", "writer", "editor"], "supervisor");
```

**Strengths:**
- Peer-to-peer coordination: Any agent can call any other
- Explicit handoffs: Full control over agent routing
- Parallel execution: Multiple agents work simultaneously
- Flexible supervision: Centralized router or distributed decisions

**Limitations:**
- Boilerplate: Router node setup required
- Context explosion: Each agent sees full conversation history (tokens balloon)
- LangGraph.js lacks some Python multi-agent examples

**Clear Winner: LangGraph.js** for sophisticated multi-agent systems. Claude Agent SDK best for hierarchical delegation.

---

## 6. Streaming & Real-time

### Claude Agent SDK

**Streaming Model:** Async generator yields messages incrementally
```typescript
for await (const message of query({
  prompt: "...",
  options: { includePartialMessages: true }
})) {
  if (message.type === "content_block_delta") {
    console.log(message.delta.text); // Character-by-character text
  } else if (message.type === "tool_use") {
    console.log("Tool call:", message.tool_name);
  }
}
```

**Event Types:**
- `content_block_delta`: Text generation (live token streaming)
- `tool_use`: Tool invocation detected
- `tool_result`: Tool execution result
- Full `AssistantMessage` after each turn

**Strengths:**
- Token-by-token streaming for responsive UIs
- Can show Claude's reasoning in real-time
- Tool calls visible as they're decided
- Works with all built-in and MCP tools

**Latency:** ~50-200ms per token (network dependent)

### LangGraph.js

**Streaming Model:** Configurable via `streamMode`
```typescript
// Stream all events
for await (const event of graph.streamEvents(
  { messages: [] },
  { configurable: { thread_id: "123" } }
)) {
  if (event.event === "on_chat_model_stream") {
    console.log(event.data.chunk.content); // Partial text
  }
}

// Or stream updates per node
for await (const update of graph.stream({ messages: [] })) {
  console.log(update); // Node outputs only
}
```

**Event Types:**
- `on_chat_model_stream`: Model token streaming
- `on_tool_start`/`on_tool_end`: Tool execution lifecycle
- Node-level updates: Output from each node after execution

**Strengths:**
- Rich event filtering (subscribe to specific node/tool events)
- Middleware-based streaming (easy to transform events)
- Multiple stream modes (full events vs updates-only)

**Limitations:**
- More verbose setup (requires understanding event schema)
- Latency higher in LangGraph.js vs Python (not optimized yet)

**Tie.** Both stream well. Claude Agent SDK simpler; LangGraph more granular.

---

## 7. Observability

### Claude Agent SDK

**Native Observability:**
- Built-in cost tracking: Each message includes `cost` and `token_usage`
- Session IDs: Trace execution across API calls
- Hooks: `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd` for custom logging

**Example:**
```typescript
const logHook: HookCallback = async (input) => {
  console.log("File modified:", input.tool_input.file_path);
  return {};
};

for await (const msg of query({
  prompt: "...",
  options: {
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [logHook] }]
    }
  }
})) { }
```

**Third-party Integrations:**
- **Langfuse**: Auto-traces all tool calls as OpenTelemetry spans
- **LangSmith**: Native integration for run tracking
- **SigNoz**: OpenTelemetry export
- **Arize (Dev-Agent-Lens):** OpenInference traces
- **Scorecard:** Zero-code setup via 4 env vars

**Strengths:**
- Out-of-box cost visibility (critical for production)
- Hooks elegant for audit logging, approval workflows
- Rich third-party ecosystem (Langfuse, Datadog, Honeycomb)

**Limitations:**
- No native time-travel debugging (unlike LangGraph Studio)
- Limited insight into Claude's reasoning (only tool calls visible)

### LangGraph.js

**Native Observability:**
- LangGraph Studio: Visual graph execution with state inspection
- Time-travel: Replay from any checkpoint
- Node-level tracing: See every node input/output

**Third-party Integrations:**
- **LangSmith:** Deep integration (tracing, evaluation, feedback loops)
- **OpenTelemetry:** Standard instrumentation

**Strengths:**
- LangGraph Studio unmatched for debugging (visual + interactive)
- Checkpoint replay is a debugging superpower
- LangSmith integration tight (team originally built LangGraph)

**Limitations:**
- Production observability less mature than Claude Agent SDK
- Requires external tool (Studio) for visual debugging
- Cost tracking not built-in (must implement yourself)

**Winner: Claude Agent SDK** for production ops. **LangGraph Studio** for development debugging.

---

## 8. Model Support

### Claude Agent SDK

**Model Coupling:** Claude-only
- Optimized for Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 4 (when available)
- Automatic context compaction tuned to Claude's capabilities
- Tool calling semantics match Claude's XML-based tool definitions

**No Multi-Model Support:**
- Cannot switch to GPT-4 or Gemini mid-workflow
- Not designed for multi-model optimization (routing by cost/capability)

**Strengths:**
- Deep optimization for Claude
- No model abstraction overhead
- Tool execution perfectly aligned with Claude's behavior

**Limitations:**
- Vendor lock-in: Moving to another model requires rewrite
- Can't use best-of-breed models (Claude for reasoning, GPT-4o for vision, etc)

### LangGraph.js

**Model Agnostic:** Works with any LangChain-supported LLM
- Claude (Anthropic)
- GPT-4, GPT-4o (OpenAI)
- Gemini 2.0 Flash (Google)
- Cohere
- Open-source (Llama, DeepSeek via LlamaCPP)

**Example: Mixed Models**
```typescript
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

graph
  .addNode("research", async (state) => {
    const model = new ChatOpenAI({ model: "gpt-4o" });
    return { /* research output */ };
  })
  .addNode("writer", async (state) => {
    const model = new ChatAnthropic({ model: "claude-3-5-sonnet" });
    return { /* writing output */ };
  });
```

**Strengths:**
- No vendor lock-in: Replace model without changing code
- Cost optimization: Route tasks to cheapest capable model
- Best-of-breed: Use GPT-4o vision + Claude reasoning in same workflow

**Limitations:**
- Tool calling abstraction layer adds latency
- Different models have different tool calling nuances (must handle)
- No automatic optimization (developer responsible for routing)

**Clear Winner: LangGraph.js** for flexibility. Claude Agent SDK wins for Claude optimization.

---

## 9. Production Readiness

### Claude Agent SDK

**Stability:** Production-grade (powers Claude Code)
- Proven infrastructure used daily by thousands
- Error handling built-in for long-running tasks
- Automatic retries on transient failures

**Known Production Challenges:**
- **Context Window Issues:** Even Claude 4.5 can run out of context mid-implementation on large projects
- **Quality Control:** Model tends to mark features complete without proper end-to-end testing
- **Vision/Browser Limitations:** Can't detect browser alerts via Puppeteer; some visual bugs slip through
- **API Key Only:** Cannot use claude.ai Pro/Max billing (must use API keys); barrier for solo developers
- **Requires Sandboxing:** Should run inside container (Docker) for process isolation, resource limits

**Error Handling:**
- Automatic: Tool timeouts, API retries
- Manual: Hooks for custom error logic
- Graceful degradation: Sessions can resume after errors

**Rate Limiting:** Respects Claude API rate limits (managed by Anthropic)

### LangGraph.js

**Stability:** Production-ready but less mature than Python
- LangGraph Python: Mature (used in production by LangChain users)
- LangGraph.js: Lags behind Python version

**Known Production Issues (2025):**
- **Maturity Gap:** GitHub issue #850 (Feb 2025): "Is langgraphjs production ready?" —indicates ecosystem concerns
- **JSON Parsing Bug:** Errors sometimes parsed as JSON, causing unexpected failures
- **Tool Node Error Handling:** Disabled by default after v1.0.1; exceptions can propagate uncaught
- **Checkpointer Overhead:** Persisting large state to databases scales poorly with checkpoint volume

**Error Handling:**
- Nodes can raise exceptions (must be caught manually)
- Retry policies: Can build retry loops as graph nodes
- Human-in-the-loop: Modify state and resume on error

**Deployment Options:**
- Self-hosted: Run your own infrastructure
- LangGraph Cloud: Managed platform (commercial)
- LangGraph Platform: On-prem or BYOC

**Verdict:** Claude Agent SDK more battle-tested. LangGraph.js production-ready but requires more care.

---

## 10. Cost & Token Efficiency

### Claude Agent SDK

**Token Overhead:**
- Computer use feature: +466-499 tokens in system prompt
- Automatic context compaction: Reduces redundant context as conversation grows
- MCP tool definitions: Can consume 100-500 tokens depending on tool complexity

**Cost Drivers:**
- Long-running agents: Multiple turns = multiple API calls = cumulative costs
- Large codebases: File reading/search over 1000+ files adds tokens
- Auto-compaction: Summarization overhead (Claude re-reads context)

**Optimization Strategies:**
- Use `allowedTools` to limit tool set (reduces system prompt)
- Session reuse: Avoid starting new sessions unnecessarily
- MCP tool search: Load tools on-demand, not upfront

**Typical Agent Cost:** $0.01–0.50 per task (small to medium codebases)

### LangGraph.js

**Token Overhead:**
- Graph execution: Each node call = new API request = overhead
- State accumulation: Passing full state to every node consumes tokens
- Context cycles: Careless edge design causes repeated context passing (expensive)

**Cost Drivers:**
- Multi-agent workflows: N agents × M steps = N×M API calls
- Checkpointing: Storing state snapshots (disk I/O, not token cost, but operational cost)
- Unoptimized routing: Router nodes calling LLM at every step

**Token Efficiency:** Lower than Claude Agent SDK for simple agents; higher for complex orchestration
- Graph-based approach minimizes redundant context vs conversation-driven frameworks
- Unmanaged cycles can cause token explosion (must be careful with edge logic)

**Optimization Strategies:**
- Efficient state schema: Only include necessary fields per node
- Batch tool calls: Avoid requesting multiple tools per step
- Conditional edges: Don't call LLM router at every step (use deterministic logic)

**Typical Workflow Cost:** $0.05–2.00 per execution (depends heavily on graph complexity)

**Verdict:** Claude Agent SDK lower overhead for simple agents. LangGraph scalable for complex workflows if designed carefully.

---

## 11. Community & Ecosystem

### Claude Agent SDK

**GitHub Metrics:**
- **Repository:** github.com/anthropics/claude-agent-sdk-python, claude-agent-sdk-typescript
- **Activity:** ~50 commits/month, steady updates
- **Stars:** ~2-3K (smaller than LangChain but growing)
- **Contributors:** ~20 (Anthropic team + external)

**npm/PyPI:**
- **npm:** `@anthropic-ai/claude-agent-sdk` (v0.2.71 as of March 2026)
- **PyPI:** `claude-agent-sdk` (v0.1.48)
- **Weekly Downloads:** ~15K npm (growing rapidly)

**Ecosystem:**
- Integrations: Langfuse, LangSmith, Datadog, Scorecard, MLflow
- Examples: Email assistant, research agent, code reviewer, debugging agent
- Community: Smaller but tight-knit; good forums/Discord

**Adoption:**
- Anthropic-backed (strong institutional support)
- Used by Klarna, Elastic, startups
- Enterprise adoption growing

### LangGraph.js

**GitHub Metrics:**
- **Repository:** github.com/langchain-ai/langgraphjs
- **Activity:** ~100+ commits/month (very active)
- **Stars:** 4-5K (LangGraph Python has 10K+)
- **Contributors:** 50+ (LangChain team + ecosystem)

**npm/PyPI:**
- **npm:** `@langchain/langgraph` (v0.2+)
- **Weekly Downloads:** ~50K+ (mature ecosystem)

**Ecosystem:**
- Integrations: 100+ LangChain tools, Zapier, Hugging Face, LLaMA Index
- Examples: Abundant (Python > JavaScript)
- Community: Large and active (LangChain's AGI Hacker House, Discord, forums)

**Adoption:**
- LangChain-backed (industry standard orchestration)
- Used by Klarna, Elastic, enterprise teams
- LangGraph Platform: Commercial offering

**Verdict:** LangGraph larger ecosystem. Claude Agent SDK newer but rapidly growing.

---

## 12. Code Examples: Direct Comparison

### Scenario: Simple Bug-Fixing Agent

#### Claude Agent SDK (8 lines)
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in src/auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);
}
```

#### LangGraph.js (~60 lines)
```typescript
import { StateGraph, START, END, StateAnnotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Define tools
const readFileTool = tool(
  async ({ path }) => fs.readFileSync(path, "utf-8"),
  { name: "read_file", description: "Read file", schema: z.object({ path: z.string() }) }
);

const StateAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: (curr = [], update) => curr.concat(update)
  })
});

const graph = new StateGraph(StateAnnotation)
  .addNode("agent", async (state) => {
    const model = new ChatAnthropic();
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("tools", new ToolNode([readFileTool]))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", (state) => {
    // Route: if tool call, go to tools; else END
    return state.messages[-1].tool_calls?.length ? "tools" : END;
  })
  .addEdge("tools", "agent")
  .compile();

const result = await graph.invoke({
  messages: [{ role: "user", content: "Find and fix the bug in src/auth.py" }]
});
console.log(result);
```

### Winner: Claude Agent SDK by brevity. LangGraph provides more control.

---

### Scenario: Multi-Agent Code Review + Refactoring

#### Claude Agent SDK
```typescript
for await (const message of query({
  prompt: "Use code-reviewer to review src/, then use refactorer to optimize",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Agent"],
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer",
        prompt: "Check for bugs, security, performance",
        tools: ["Read", "Glob", "Grep"]
      },
      "refactorer": {
        description: "Code optimization specialist",
        prompt: "Refactor for readability and performance",
        tools: ["Read", "Edit", "Bash"]
      }
    }
  }
})) {
  console.log(message);
}
```

#### LangGraph.js
```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("supervisor", async (state) => {
    const model = new ChatAnthropic();
    const response = await model.invoke([
      ...state.messages,
      { role: "system", content: "Route to reviewer, refactorer, or END" }
    ]);
    return {
      messages: [response],
      next_agent: response.content.includes("review") ? "reviewer" : "refactorer"
    };
  })
  .addNode("reviewer", reviewerAgent)
  .addNode("refactorer", refactorerAgent)
  .addConditionalEdges("supervisor", (state) => state.next_agent, {
    reviewer: "reviewer",
    refactorer: "refactorer",
    END: END
  })
  .addEdge(["reviewer", "refactorer"], "supervisor")
  .addEdge(START, "supervisor")
  .compile();

await graph.invoke({ messages: [] });
```

### Winner: Claude Agent SDK for simplicity. LangGraph for explicit control.

---

## 13. Comparison Matrix

| Dimension | Claude Agent SDK | LangGraph.js | Winner |
|-----------|------------------|-------------|--------|
| **Setup Time** | 5 min | 30 min | Claude |
| **First Agent** | 10 lines | 60+ lines | Claude |
| **Multi-Agent** | Hierarchical | Peer-to-peer | LangGraph |
| **State Management** | Implicit sessions | Explicit checkpoints | LangGraph |
| **Streaming** | Token-level | Event-level | Tie |
| **Model Support** | Claude only | Any LangChain | LangGraph |
| **Observability (Prod)** | Better (cost, hooks) | Better (Studio, replay) | Tie |
| **Error Handling** | Automatic | Manual | Claude |
| **TypeScript DX** | Excellent | Good | Claude |
| **Production Maturity** | Battle-tested | Proven (Python > JS) | Claude |
| **Ecosystem** | Growing | Mature | LangGraph |
| **Context Management** | Auto-compacted | Manual | Claude |
| **Learning Curve** | 2 hours | 1 week | Claude |
| **Token Efficiency** | Lower overhead | Depends on design | Claude (simple), LangGraph (complex) |
| **Cost per Agent** | $0.01-0.50 | $0.05-2.00 | Claude |
| **Debugging** | Hooks + logs | Studio + replay | LangGraph |

---

## 14. When to Use Each

### Use Claude Agent SDK if:
- ✅ Building sophisticated single agent (code review, bug fixing, analysis)
- ✅ Need automatic context management (long-running tasks)
- ✅ File operations central to agent (read, edit, search codebases)
- ✅ Want rapid prototype → production (minimal setup)
- ✅ Team comfortable with implicit agent loop
- ✅ Cost-sensitive (lower token overhead)
- ✅ Must use Claude models for compliance/optimization

### Use LangGraph.js if:
- ✅ Multi-agent orchestration required (supervisor + specialists)
- ✅ Complex control flow (conditionals, loops, approval gates)
- ✅ Need multi-model support (Claude + GPT-4 + Gemini)
- ✅ Debugging critical (time-travel replay needed)
- ✅ Human-in-the-loop approval workflows required
- ✅ State must be explicitly versioned/replayed
- ✅ Team prefers graph-based mental model

### Hybrid Approach (RECOMMENDED):
**Use LangGraph nodes that call Claude Agent SDK** for best of both worlds:
- LangGraph orchestrates (complex workflows, multi-agent)
- Each node executes a Claude Agent SDK agent (automatic context management)
- Combines explicit control flow + implicit agent sophistication

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("claude-research", async (state) => {
    // Invoke Claude Agent SDK from within LangGraph node
    const results = [];
    for await (const msg of query({
      prompt: "Research topic X",
      options: { allowedTools: ["WebSearch", "WebFetch"] }
    })) {
      results.push(msg);
    }
    return { messages: [...state.messages, results] };
  })
  .addNode("claude-writer", async (state) => {
    // Another agent
    for await (const msg of query({
      prompt: "Write article based on research",
      options: { allowedTools: ["Edit"] }
    })) {
      results.push(msg);
    }
    return { messages: [...state.messages, results] };
  });
```

---

## 15. Limitations & Gotchas

### Claude Agent SDK Gotchas

1. **Context Window Exhaustion:** Long-running tasks can deplete context mid-operation
   - **Mitigation:** Design agents for focused tasks; use subagents for large projects

2. **Model Quality Variance:** Claude sometimes marks features complete without testing
   - **Mitigation:** Explicit prompts for validation; test assertions in agent instructions

3. **Vision Limitations:** Can't detect browser modals; some visual bugs slip through
   - **Mitigation:** Use deterministic testing (API calls) over UI testing

4. **No Conditional Logic:** Difficult to implement "if X then Y" workflows
   - **Mitigation:** Use subagents for branching logic; pass explicit instructions

5. **API Keys Required:** Cannot use claude.ai Pro/Max billing (alone barrier for solo devs)
   - **Mitigation:** Teams should use API key auth; consider OpenRouter/Azure for cost

6. **Session Opacity:** Cannot inspect session state mid-execution
   - **Mitigation:** Use hooks for custom logging/inspection

### LangGraph.js Gotchas

1. **Maturity Gap (JS vs Python):** LangGraph.js lags in features and examples
   - **Mitigation:** Check GitHub issues; fallback to Python examples for patterns

2. **JSON Parsing Errors:** Errors sometimes parsed as JSON, causing unexpected failures
   - **Mitigation:** Use error handling middleware; catch JSON.parse errors explicitly

3. **Tool Error Handling Disabled:** After v1.0.1, tool errors propagate unhandled
   - **Mitigation:** Wrap tool nodes in try-catch; use retry policies

4. **Context Explosion:** Each agent sees full conversation history
   - **Mitigation:** Implement message summarization or selective context passing

5. **Checkpoint Overhead:** Persisting large state scales poorly
   - **Mitigation:** Use memory-based checkpointer for dev; implement cleanup for prod

6. **Boilerplate Fatigue:** Simple agents require significant setup
   - **Mitigation:** Build abstractions; use starter templates

---

## 16. Migration Paths

### From Claude Agent SDK → LangGraph.js
- Extract agent loop into graph nodes
- Define StateAnnotation for message history
- Implement tool calling via ToolNode
- Map subagents to graph nodes
- Complex control flow becomes edge logic

**Effort:** 2-3 days for simple agents; 1-2 weeks for sophisticated agents

### From LangGraph.js → Claude Agent SDK
- Cannot use multi-model (only Claude supported)
- Complex control flow becomes implicit (less explicit)
- Lose checkpointing (use sessions instead)
- Simplify significantly: Remove node/edge boilerplate

**Effort:** 1 day; mostly deletion

---

## 17. Recommendations

### For Teams Starting Today (March 2026)

**Small Teams (1-5 devs):**
- **Start:** Claude Agent SDK for first agent
- **Scale:** Migrate to LangGraph.js if multi-agent/complex workflows needed
- **Hybrid:** Use both (LangGraph orchestrates Claude agents)

**Enterprise Teams:**
- **Multi-Model:** LangGraph.js from day one
- **Cost Control:** Use Claude Agent SDK within LangGraph nodes
- **Observability:** Langfuse/LangSmith for unified tracing

**Startups (MVP focus):**
- **Fast:** Claude Agent SDK (5-minute setup)
- **Scaling:** Hybrid approach as complexity grows

### Production Deployment Checklist

**Claude Agent SDK:**
- [ ] Run in Docker container (process isolation)
- [ ] Set up Langfuse/Scorecard for cost tracking
- [ ] Implement hooks for audit logging
- [ ] Configure retry policies for transient failures
- [ ] Monitor session memory usage
- [ ] Test context window exhaustion scenarios

**LangGraph.js:**
- [ ] Deploy with PostgreSQL/Snowflake checkpointer
- [ ] Enable LangGraph Studio for debugging
- [ ] Set up LangSmith for tracing
- [ ] Implement error handling in every node
- [ ] Test checkpoint restoration (disaster recovery)
- [ ] Optimize state schema (remove unnecessary fields)
- [ ] Monitor checkpoint volume (cleanup old threads)

---

## 18. Unresolved Questions

1. **LangGraph.js vs Python Feature Parity Timeline:** When will LangGraph.js match Python capabilities?
2. **Claude Agent SDK Multi-Model Support:** Will Anthropic add Claude/GPT interop in future?
3. **MCP as Primary Protocol:** Will MCP standardization reduce need for framework-specific integration?
4. **Cost Trajectory:** As agent usage scales, how will token pricing evolve (will it become unsustainable)?
5. **Deterministic vs AI Routing:** Best practices for mixing graph routing (deterministic) vs LLM routing (AI-driven)?

---

## 19. Key Takeaways

1. **Different Leagues:** Claude Agent SDK ≠ LangGraph. SDK is single-agent harness; LangGraph is orchestration platform.

2. **Complementary, Not Competitive:** LangGraph nodes can execute Claude Agent SDK calls. They strengthen each other.

3. **Claude SDK Wins on:** Setup speed, context management, single-agent sophistication, cost for simple tasks.

4. **LangGraph Wins on:** Multi-agent orchestration, state management, debugging, model flexibility, complex workflows.

5. **Production Reality:** Most teams end up hybrid (LangGraph orchestrating Claude agents) for sophistication + control.

6. **TypeScript Consideration:** LangGraph.js less mature than Python; Claude Agent SDK TypeScript excellent. If JavaScript-only, Claude Agent SDK better for 2026.

7. **2026 Trend:** Agent frameworks consolidating. MCP will likely become primary integration layer for both.

---

## Sources

- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart)
- [LangGraph Overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LangGraph Persistence & Checkpointing](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [AI Framework Comparison 2025](https://enhancial.substack.com/p/choosing-the-right-ai-framework-a)
- [MCP Server with LangGraph vs Claude Agent SDK](https://mcp-server-langgraph.mintlify.app/comparisons/vs-claude-agent-sdk)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [14 AI Agent Frameworks Compared](https://softcery.com/lab/top-14-ai-agent-frameworks-of-2025-a-founders-guide-to-building-smarter-systems)
- [Complete Guide to Claude Agent SDK](https://nader.substack.com/p/the-complete-guide-to-building-agents)
- [Claude Agent SDK Observability with Langfuse](https://langfuse.com/integrations/frameworks/claude-agent-sdk)
- [LangGraph Production AI Agents](https://www.langchain.com/langgraph)
- [LangGraph Multi-Agent Systems Tutorial](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-multi-agent-systems-complete-tutorial-examples)
- [Claude Agent SDK vs LangGraph Cost & Token Efficiency](https://softcery.com/lab/top-14-ai-agent-frameworks-of-2025-a-founders-guide-to-building-smarter-systems)
- [Ask HN: Anyone using Claude Agent SDK in production?](https://news.ycombinator.com/item?id=46679473)
- [LangGraph.js Production Issues & Error Handling](https://dev.to/aiengineering/a-beginner-guide-to-handling-errors-in-langgraph-with-retry-policies-h22)
- [LangGraph.js Multi-Model Support](https://medium.com/@lecharles/gpt-5-as-agent-judge-evaluating-a-multi-agent-system-using-openai-anthropic-and-langgraph-5fb207f5def4)
- [Claude Agent SDK MCP Integration](https://platform.claude.com/docs/en/agent-sdk/mcp)

---

**Report Compiled:** March 17, 2026
**Analysis Duration:** 4 hours (multi-source research + official documentation review)
**Confidence Level:** High (based on official docs, production reports, community feedback, GitHub analysis)
