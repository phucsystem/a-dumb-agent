# LangGraph.js Memory & Tool Calling Research
**Date:** March 17, 2026 | **Scope:** Short-term/long-term memory, checkpointing, tool calling, MCP integration

---

## EXECUTIVE SUMMARY

LangGraph.js (v0.2+) provides production-grade memory systems via **checkpointers** (thread-scoped) and **stores** (cross-thread), with semantic search capabilities for intelligent memory recall. Tool calling is handled through **ToolNode** with automatic parallel execution and dynamic MCP tool binding. All components support both in-memory dev implementations and production-grade DB backends.

---

## 1. SHORT-TERM MEMORY (Thread-Scoped)

### Checkpointer Overview
Checkpointers save graph state as snapshots at "super-step" boundaries (when all scheduled nodes execute). Each checkpoint is tagged with a `thread_id` to group related interactions into conversations.

**Key capabilities:**
- Conversation persistence across multiple exchanges
- Human-in-the-loop workflow interruption/resumption
- Time-travel debugging via `getStateHistory()`
- Fault recovery from last checkpoint

### MemorySaver (Dev/Testing)
```javascript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = builder.compile({ checkpointer });

// Invoke with thread_id
const config = { configurable: { thread_id: "user-123" } };
const result = await graph.invoke(state, config);
```

**Characteristics:**
- In-process RAM storage, lost on restart
- No setup required
- Ideal for development

### PostgresSaver (Production)
```javascript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(
  "postgresql://user:password@localhost/dbname"
);
await checkpointer.setup(); // Create schema once
const graph = builder.compile({ checkpointer });
```

**Checkpoint structure:**
```json
{
  "v": 1,
  "ts": "2024-07-31T20:14:19.804150+00:00",
  "id": "uuid-here",
  "channel_values": { "messages": [...], "state_key": "value" },
  "channel_versions": { "__start__": 2, "node": 3 },
  "versions_seen": { },
  "pending_sends": []
}
```

**Characteristics:**
- Durable storage across restarts
- Scales to production traffic
- Requires Postgres setup

### Other Checkpointer Backends
- **SqliteSaver**: Local single-file persistence
- **MongoDBSaver**: Document DB backend
- **RedisSaver**: High-performance cache backend

### State Retrieval & Modification
```javascript
// Get current state
const state = await graph.getState(config);

// Get full history
const history = await graph.getStateHistory(config);
history.forEach(checkpoint => {
  console.log(checkpoint.values); // Access past states
});

// Modify state (creates new checkpoint)
await graph.updateState(config, { messages: newMessages });
```

---

## 2. LONG-TERM MEMORY (Cross-Thread)

### Store API Fundamentals
Stores maintain namespaced key-value data across conversations using three memory types:

**Semantic Memory** - Facts about users (updated profiles or document collections)
**Episodic Memory** - Past experiences/actions (few-shot examples, task history)
**Procedural Memory** - Operational rules (refined system prompts, learned patterns)

### InMemoryStore (Dev)
```javascript
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();

// Basic put/get
await store.put(["user_123", "preferences"], "theme", {
  value: "dark",
  updated: Date.now()
});

const pref = await store.get(["user_123", "preferences"], "theme");
console.log(pref.value); // "dark"

// List all keys in namespace
const keys = await store.listKeys(["user_123", "preferences"]);
// ["theme", "language", ...]

// Delete
await store.delete(["user_123", "preferences"], "theme");
```

**Batch operations:**
```javascript
await store.batch([
  {
    type: "put",
    namespace: ["user_123", "memories"],
    key: "memory_1",
    value: { text: "Loves pizza", source: "chat" }
  },
  {
    type: "put",
    namespace: ["user_123", "memories"],
    key: "memory_2",
    value: { text: "Works as plumber", source: "chat" }
  }
]);
```

**Characteristics:**
- In-process RAM storage
- No setup needed
- Data lost on restart

### Semantic Search with InMemoryStore
```javascript
import { InMemoryStore } from "@langchain/langgraph";
import { OpenAIEmbeddings } from "@langchain/openai";

const store = new InMemoryStore({
  index: {
    dims: 1536,
    embeddings: new OpenAIEmbeddings({
      modelName: "text-embedding-3-small"
    }),
  }
});

// Store memories with semantic indexing
await store.put(["user_123", "memories"], "mem_1", {
  text: "I love traveling to mountains"
});
await store.put(["user_123", "memories"], "mem_2", {
  text: "I'm a software engineer"
});

// Semantic search across memories
const relevant = await store.search(["user_123", "memories"], {
  query: "travel experiences",  // Natural language query
  limit: 5
});
// Returns: [mem_1, ...] scored by semantic similarity
```

### User Profile Example (Hot Path Write)
```javascript
async function updateUserProfile(store, userId, interaction) {
  // Extract facts from conversation in real-time
  const memory = {
    text: interaction.userMessage,
    timestamp: Date.now(),
    type: "conversation"
  };

  await store.put(
    [userId, "semantic_memories"],
    `mem_${Date.now()}`,
    memory
  );
}

// In agent graph node
async function processMessage(state, store) {
  const userId = state.userId;
  const lastMessage = state.messages[state.messages.length - 1];

  // Retrieve relevant memories for context
  const memories = await store.search(
    [userId, "semantic_memories"],
    {
      query: lastMessage.content,
      limit: 3
    }
  );

  // Include in system prompt
  state.relevantMemories = memories;
  return state;
}
```

### PostgresStore (Production)
```javascript
import { PostgresStore } from "@langchain/langgraph";

const store = new PostgresStore({
  connectionString: "postgresql://...",
  schema: "custom_schema"
});
await store.setup();

// Same API as InMemoryStore, but with persistence
await store.put(["user_123", "profile"], "name", { value: "Alice" });
const item = await store.get(["user_123", "profile"], "name");

// Semantic search works identically
const results = await store.search(["user_123", "memories"], {
  query: "recent projects"
});
```

---

## 3. TOOL CALLING

### Tool Definition
```javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const getWeather = tool(
  (input) => {
    const { location } = input;
    if (["sf", "san francisco"].includes(location.toLowerCase())) {
      return "It's 60 degrees and foggy.";
    } else {
      return "It's 90 degrees and sunny.";
    }
  },
  {
    name: "get_weather",
    description: "Call to get the current weather for a location.",
    schema: z.object({
      location: z.string().describe("The location to get weather for")
    })
  }
);

const tools = [getWeather];
```

### ToolNode & Graph Integration
```javascript
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

const toolNode = new ToolNode(tools);

const builder = new StateGraph(MessagesAnnotation)
  .addNode("llm", callLlmNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "llm")
  .addConditionalEdges(
    "llm",
    toolsCondition,  // Routes to "tools" if tool calls present
    { tools: "tools", end: END }
  )
  .addEdge("tools", "llm");

const graph = builder.compile();
```

### Tool Binding to LLM
```javascript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-3-haiku-20240307",
  temperature: 0
});

// Bind tools to model
const modelWithTools = model.bindTools(tools, {
  tool_choice: "auto"  // "auto" | "any" | "required" | specific tool name
});

// In LLM node
async function callLlmNode(state) {
  const result = await modelWithTools.invoke(state.messages);
  return { messages: [result] };
}
```

### Tool Execution Flow
ToolNode:
1. Inspects last message for `tool_calls` field
2. Executes each tool in **parallel** (if multiple calls)
3. Returns list of ToolMessages with results
4. Graph routes back to LLM for reasoning

Example execution:
```javascript
// LLM returns tool_calls
const toolCalls = [
  { name: "get_weather", args: { location: "sf" }, id: "call_1" },
  { name: "get_weather", args: { location: "ny" }, id: "call_2" }
];

// ToolNode executes both in parallel
// Returns: [ToolMessage(...), ToolMessage(...)]
```

### createReactAgent (Prebuilt)
**Note:** As of v1.0, `createReactAgent` is deprecated in Python but equivalent functionality remains in JS.

```javascript
// Alternative: Use manual StateGraph (recommended)
// Provides more control and flexibility
```

---

## 4. MCP TOOL INTEGRATION

### Dynamic Tool Loading
```javascript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const mcpClient = new MultiServerMCPClient({
  servers: [
    {
      transport: "stdio",
      command: "/path/to/mcp-server",
      env: { /* env vars */ }
    },
    {
      transport: "sse",
      url: "http://localhost:3000/mcp"
    }
  ]
});

// Discover available tools from MCP servers
const mcpTools = await mcpClient.listTools();
// Returns: Array of tool definitions from all MCP servers

// Convert to LangChain StructuredTools
const langchainTools = mcpTools.map(toolDef =>
  createMCPToolAdapter(toolDef)
);
```

### Tool Binding with MCP Integration
```javascript
import { createMCPAdapter } from "@langchain/mcp-adapters";

// Fetch MCP tools at runtime
async function setupAgent(mcpServerUrl) {
  const adapter = await createMCPAdapter(mcpServerUrl);
  const tools = await adapter.listTools();

  const model = new ChatAnthropic({ model: "claude-3-haiku" });
  const modelWithTools = model.bindTools(tools);

  const toolNode = new ToolNode(tools);

  return { model: modelWithTools, toolNode, tools };
}
```

### MCP + Stdio Transport
```javascript
const mcpClient = new MultiServerMCPClient({
  servers: [{
    transport: "stdio",
    command: "python",
    args: ["/path/to/mcp-server.py"],
    env: process.env
  }]
});

const tools = await mcpClient.listTools();
```

### MCP + HTTP/SSE Transport
```javascript
const mcpClient = new MultiServerMCPClient({
  servers: [{
    transport: "sse",
    url: "http://localhost:8080/mcp"
  }]
});
```

**Characteristics:**
- Dynamic tool discovery at runtime
- Supports stdio, SSE, HTTP transports
- Human-in-the-loop tool approval possible
- Real-time streaming compatible

---

## 5. PRACTICAL INTEGRATION EXAMPLE

### Agent with Checkpoints + Store + Tools
```javascript
import { StateGraph, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { InMemoryStore } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";

// Setup
const checkpointer = new MemorySaver();
const store = new InMemoryStore();
const tools = [getWeather]; // defined elsewhere
const model = new ChatAnthropic({ model: "claude-3-haiku" });
const modelWithTools = model.bindTools(tools);

// Graph
const builder = new StateGraph(MessagesAnnotation)
  .addNode("llm", async (state) => {
    // Retrieve user memories for context
    const memories = await store.search(
      [state.userId, "memories"],
      { query: state.messages[-1].content, limit: 3 }
    );

    // Include in prompt
    const systemMsg = [
      "You are helpful. Remember: " +
      memories.map(m => m.value.text).join(", ")
    ].join("\n");

    const result = await modelWithTools.invoke(state.messages);
    return { messages: [result] };
  })
  .addNode("tools", new ToolNode(tools))
  .addEdge("__start__", "llm")
  .addConditionalEdges("llm", toolsCondition, { tools: "tools", end: END })
  .addEdge("tools", "llm");

const graph = builder.compile({ checkpointer });

// Usage
const userId = "user-123";
const threadId = "conv-456";
const config = { configurable: { thread_id: threadId } };

// First message
const result1 = await graph.invoke({
  messages: [{ role: "user", content: "What's the weather in SF?" }],
  userId
}, config);

// Update memories
await store.put([userId, "memories"], "mem_1", {
  text: "User asked about SF weather"
});

// Second message (same thread, has history)
const result2 = await graph.invoke({
  messages: [{ role: "user", content: "And in NY?" }],
  userId
}, config);
// Graph has access to SF question from checkpoint history
```

---

## 6. KEY DIFFERENCES: Short-Term vs Long-Term

| Aspect | Short-Term (Checkpointer) | Long-Term (Store) |
|--------|--------------------------|-------------------|
| **Scope** | Single thread/conversation | Cross-thread, user-scoped |
| **Data** | Full graph state snapshots | Arbitrary JSON documents |
| **Keying** | thread_id | Namespace path + key |
| **Search** | Sequential history replay | Semantic similarity (with embeddings) |
| **Use Cases** | Conversation history, resumption | User profiles, learned facts, examples |
| **Lifecycle** | Tightly coupled to thread | Independent, user-lifetime |

---

## 7. BACKEND OPTIONS & MIGRATION PATH

**Development:**
- MemorySaver (checkpoints) + InMemoryStore (long-term)
- Zero setup, in-memory only

**Staging/Production:**
- PostgresSaver (checkpoints) + PostgresStore (long-term)
- Unified Postgres backend
- Semantic search built-in

**Alternatives:**
- SqliteSaver: Local SQLite for single-machine deployments
- MongoDBSaver: Document-oriented alternative
- RedisSaver: High-performance cache layer (checkpoint only)

---

## 8. SEMANTIC SEARCH CAPABILITIES (2025+)

Both InMemoryStore and PostgresStore support semantic search:

```javascript
// Query by semantic similarity
const results = await store.search(
  ["user_123", "memories"],
  {
    query: "travel to mountains",  // Natural language
    limit: 5,
    where: { type: "travel" }      // Optional metadata filter
  }
);

// Returns sorted by semantic similarity score
results.forEach(result => {
  console.log(`${result.value.text} (score: ${result.score})`);
});
```

**Important:** Requires embeddings provider (OpenAI, Anthropic, etc.) configured on store initialization.

---

## 9. KNOWN LIMITATIONS & GOTCHAS

**MemorySaver limitations:**
- Data lost on process restart
- Not suitable for production
- Single-machine only

**InMemoryStore limitations:**
- All data in process memory
- No multi-instance sharing
- High memory usage with large datasets
- Search requires embeddings provider for each query

**MCP tool binding:**
- Dynamic tool registration currently has edge cases in LangGraph.js (open issue #1934)
- Fallback: Static tool registration with environment-based tool selection

**Checkpointer best practices:**
- Always call `.setup()` on PostgresSaver first time
- Thread IDs should be user/conversation identifiers
- Don't store sensitive data unencrypted in checkpoints

---

## 10. LATEST VERSIONS (March 2026)

- **@langchain/langgraph**: v0.2.x (stable)
- **@langchain/langgraph-checkpoint-postgres**: Latest (included in main package)
- **LangChain**: v0.3.26+ (July 2025 release)
- **Node.js requirement**: 18.13+

---

## UNRESOLVED QUESTIONS

1. Does InMemoryStore support concurrent writes across multiple instances?
2. What's the max document size for PostgresStore before performance degrades?
3. Can semantic search be disabled in PostgresStore for lower latency?
4. Timeline for createReactAgent re-stabilization in LangGraph.js?
5. Best practices for pruning old checkpoints from PostgresSaver?

---

## SOURCES

- [Memory Overview - LangChain Docs](https://docs.langchain.com/oss/javascript/langgraph/memory)
- [Persistence - LangChain Docs](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [Semantic Search for LangGraph Memory - LangChain Blog](https://blog.langchain.com/semantic-search-for-langgraph-memory/)
- [InMemoryStore API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.InMemoryStore.html)
- [BaseStore Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph-checkpoint.BaseStore.html)
- [Tool Calling - LangChain Docs](https://docs.langchain.com/oss/javascript/langchain/tools)
- [ToolNode API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph_prebuilt.ToolNode.html)
- [LangGraph MCP Integration Guide - Medium](https://medium.com/@shankeytayal/building-a-custom-mcp-client-for-langgraph-agents-a-complete-guide-d40fed2fce3c)
- [LangGraph Checkpoint Best Practices - Sparkco](https://sparkco.ai/blog/mastering-langgraph-checkpointing-best-practices-for-2025/)
- [Building Tool Calling Agents - Medium](https://medium.com/fundamentals-of-artificial-intelligence/long-term-memory-store-in-langgraph-9cc5f3d8fb42)
