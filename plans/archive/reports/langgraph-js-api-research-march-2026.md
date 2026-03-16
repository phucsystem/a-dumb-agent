# LangGraph.js API Research - March 2026

**Status:** Complete
**Date:** 2026-03-17
**Focus:** Current LangGraph.js (v0.x) API patterns for building agents

---

## 1. Imports and Package Structure

### Core Imports from `@langchain/langgraph`

```typescript
// Main graph and state management
import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
  MemorySaver,
  InMemoryStore,
  START,
  END,
} from "@langchain/langgraph";

// Tool-related imports (from prebuilt)
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";

// Message types from @langchain/core
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";

// LLM integration
import { ChatOpenAI } from "@langchain/openai";
```

**Key Pattern:**
- Core graph utilities come from `@langchain/langgraph` (main export)
- Prebuilt components (`ToolNode`, `toolsCondition`) come from `@langchain/langgraph/prebuilt`
- Messages are in `@langchain/core/messages`
- LLMs are in their respective integration packages (`@langchain/openai`, etc.)

---

## 2. StateGraph with MessagesAnnotation

### Basic Usage (Simplest Pattern)

```typescript
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

const graph = new StateGraph(MessagesAnnotation)
  .addNode("llm", callLlmNode)
  .addEdge("__start__", "llm")
  .addEdge("llm", "__end__")
  .compile();
```

**What MessagesAnnotation provides:**
- Prebuilt state schema with a `messages` key
- Built-in reducer that handles message aggregation
- Returns: `{ messages: BaseMessage[] }`
- Message merging logic: append-only by default, unless message has same ID (then update)

### Extending MessagesAnnotation with Custom Fields

```typescript
import { Annotation } from "@langchain/langgraph";
import { MessagesAnnotation } from "@langchain/langgraph";

// Option 1: Extend MessagesAnnotation with additional reducers
const ExtendedAnnotation = Annotation.Root({
  // Inherit messages from MessagesAnnotation
  ...MessagesAnnotation.spec,

  // Add custom fields
  userId: Annotation<string>({
    reducer: (left, right) => right, // Last write wins
    default: () => "default_user",
  }),

  conversationCount: Annotation<number>({
    reducer: (left, right) => left + right,
    default: () => 0,
  }),
});

const graph = new StateGraph(ExtendedAnnotation)
  .addNode("agent", agentNode)
  .compile();

// Invoke with extended state
await graph.invoke({
  messages: [new HumanMessage("Hello")],
  userId: "user_123",
  conversationCount: 0,
});
```

**Reducer Patterns:**
- **Last-write-wins:** `(left, right) => right` for single values
- **Append:** `(left, right) => left.concat(right)` for arrays
- **Merge objects:** `(left, right) => { ...left, ...right }`
- **Accumulate numbers:** `(left, right) => left + right`

### Standard MessagesAnnotation State Type

```typescript
// When using MessagesAnnotation, the state type is:
type MessageState = typeof MessagesAnnotation.State;
// Equivalent to: { messages: BaseMessage[] }

// Accessing in nodes
const node = (state: MessageState) => {
  const messages = state.messages; // BaseMessage[]
  return {
    messages: [new AIMessage("Response")],
  };
};
```

---

## 3. ChatOpenAI with Custom Base URL

### Basic Configuration with baseURL

```typescript
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  model: "gpt-4",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: "https://api.openrouter.io/openai/v1",
  },
});
```

### Using with Alternative Providers

```typescript
// DeepSeek
const deepseek = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: "https://api.deepseek.com/beta",
  },
});

// OpenRouter
const openrouter = new ChatOpenAI({
  model: "meta-llama/llama-2-70b-chat",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.io/api/v1",
  },
});

// Ollama (local)
const ollama = new ChatOpenAI({
  model: "llama2",
  apiKey: "ollama", // Required but unused
  configuration: {
    baseURL: "http://localhost:11434/v1",
  },
});

// LM Studio (local)
const lmstudio = new ChatOpenAI({
  model: "your-loaded-model",
  apiKey: "not-needed",
  configuration: {
    baseURL: "http://localhost:1234/v1",
  },
});
```

**Key Parameter:** The `configuration.baseURL` field overrides the default OpenAI endpoint. Any OpenAI-compatible API should work.

---

## 4. MemorySaver Checkpointer with Thread ID

### Setup and Compilation

```typescript
import { MemorySaver, StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Step 1: Create checkpointer
const checkpointer = new MemorySaver();

// Step 2: Build graph
const builder = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addEdge("__start__", "agent")
  .addEdge("agent", "__end__");

// Step 3: Compile with checkpointer
const graph = builder.compile({ checkpointer });
```

### Invoking with Thread ID

```typescript
// First conversation turn with thread_id "conversation_1"
const output1 = await graph.invoke(
  { messages: [new HumanMessage("I'm Bob")] },
  { configurable: { thread_id: "conversation_1" } }
);

// Second turn - same thread_id loads previous state
const output2 = await graph.invoke(
  { messages: [new HumanMessage("What's my name?")] },
  { configurable: { thread_id: "conversation_1" } }
);
// The agent can reference "Bob" from previous turn
```

### Config Format

```typescript
interface InvokeConfig {
  configurable: {
    thread_id: string; // Required for checkpointing
    // Optional: other configurable values
  };
  // Optional: streaming, timeout, etc.
}
```

**How it Works:**
- `thread_id` uniquely identifies a conversation/session
- MemorySaver persists state in memory after each invocation
- Same `thread_id` retrieves prior state on next invocation
- State is append-only for messages (handled by MessagesAnnotation reducer)
- Perfect for multi-turn conversations and memory across invocations

---

## 5. InMemoryStore for Long-Term Memory

### Create and Use InMemoryStore

```typescript
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();
```

### Put (Store) Items

```typescript
// Simple put with string key
await store.put(
  ["docs"],  // namespace as string array
  "report", // key
  {
    title: "Q4 Annual Report",
    chapters: ["Executive Summary", "Financials"],
  }
);

// Put with field indexing for vector search
await store.put(
  ["docs"],
  "article_123",
  {
    title: "AI Advances",
    content: "Recent breakthroughs in LLMs...",
    tags: ["ai", "tech"],
  },
  ["title", "content", "tags"] // Fields to index
);
```

### List Items from Namespace

```typescript
// List all items in a namespace
const items = await store.list(["docs"]);
// Returns: Item[] (array of stored objects)

// List with filtering
const filtered = await store.list(
  ["docs"],
  {
    limit: 10,
    offset: 0,
  }
);
```

### List Namespaces

```typescript
// List all namespaces
const namespaces = await store.listNamespaces();

// List with filtering
const filtered = await store.listNamespaces({
  prefix: ["documents"],
  maxDepth: 2,
  limit: 50,
});

// List namespaces ending with "v1"
const versioned = await store.listNamespaces({
  suffix: ["v1"],
});
```

### Namespace Structure

```typescript
// Typical organization patterns:
await store.put(["user:user_123", "conversations"], "conv_1", { ... });
await store.put(["user:user_123", "memories"], "fact_1", { ... });
await store.put(["tenant:org_456", "docs"], "report_1", { ... });
```

**Use Cases:**
- User memory scoped by user_id
- Multi-tenant isolation
- Fact/knowledge base organization
- Persistent state between conversations
- Vector search when indexed with embeddings

---

## 6. ToolNode and toolsCondition

### Setup ToolNode

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Define tools
const searchTool = tool(
  async (input) => {
    // Tool implementation
    return `Search results for: ${input.query}`;
  },
  {
    name: "search",
    description: "Search the web",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const tools = [searchTool];

// Create ToolNode
const toolNode = new ToolNode(tools);
```

### Use toolsCondition for Routing

```typescript
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";

const graph = new StateGraph(MessagesAnnotation)
  .addNode("llm", callLlmNode)
  .addNode("tools", toolNode)

  // Start -> LLM
  .addEdge(START, "llm")

  // LLM -> decide: tools or end?
  .addConditionalEdges(
    "llm",
    toolsCondition,
    {
      tools: "tools",    // If tool_calls present, route to tools
      "__end__": END,    // Otherwise end
    }
  )

  // Tools -> back to LLM
  .addEdge("tools", "llm")

  .compile();
```

### How toolsCondition Works

```typescript
// toolsCondition reads the last AIMessage and checks:
// 1. Does it have tool_calls?
// 2. If yes, return "tools" (route to ToolNode)
// 3. If no, return "__end__" (route to END)

// The AIMessage.tool_calls looks like:
[
  {
    id: "call_1",
    name: "search",
    args: { query: "LangGraph" },
  }
]
```

**ReAct Loop Pattern:**
1. User message → LLM
2. LLM generates response + tool_calls
3. toolsCondition checks for tool_calls
4. If present: ToolNode executes them, returns ToolMessage
5. If not: Graph ends, return final response

---

## 7. Message Types

### Core Message Classes

```typescript
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";

// Create messages
const humanMsg = new HumanMessage("What is LangGraph?");
const systemMsg = new SystemMessage("You are a helpful assistant.");
const aiMsg = new AIMessage("LangGraph is a framework...");
const toolMsg = new ToolMessage("Tool result here", { tool_call_id: "call_1" });
```

### Message Properties

```typescript
const msg = new AIMessage("Response text", {
  tool_calls: [
    {
      id: "call_1",
      name: "search",
      args: { query: "example" },
    },
  ],
  tool_call_id: "some_id", // For ToolMessage
});

// Access properties
msg.content;        // "Response text"
msg.tool_calls;     // Array of tool calls
msg.response_metadata; // Contains model info
msg.id;              // Message ID (for updates)
```

### Message Array Pattern

```typescript
const messages: BaseMessage[] = [
  new SystemMessage("You are helpful."),
  new HumanMessage("Question?"),
  new AIMessage("Answer."),
  new ToolMessage("Tool result", { tool_call_id: "call_1" }),
];

// All messages share BaseMessage interface
for (const msg of messages) {
  console.log(msg.content);
}
```

---

## 8. Graph Invocation

### Basic invoke() Pattern

```typescript
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .compile();

// Invoke and get output
const output = await graph.invoke({
  messages: [new HumanMessage("Hello")],
});

// output type: typeof MessagesAnnotation.State
// output.messages is the accumulated message list
console.log(output.messages); // [HumanMessage, AIMessage, ...]
```

### With Checkpointer and Thread ID

```typescript
const checkpointer = new MemorySaver();
const graph = builder.compile({ checkpointer });

// Invoke with thread configuration
const output = await graph.invoke(
  { messages: [new HumanMessage("First message")] },
  { configurable: { thread_id: "session_1" } }
);
```

### Full Example with Extended State

```typescript
const ExtendedState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>({
    reducer: (left, right) => right,
    default: () => "anonymous",
  }),
});

const graph = new StateGraph(ExtendedState)
  .addNode("process", processNode)
  .compile();

const result = await graph.invoke({
  messages: [new HumanMessage("Analyze this")],
  userId: "user_456",
});

// result.messages will have all messages
// result.userId will be "user_456"
```

### Return Value Structure

```typescript
// When using MessagesAnnotation:
type Output = {
  messages: BaseMessage[]; // All accumulated messages
};

// When extended with custom fields:
type ExtendedOutput = {
  messages: BaseMessage[];
  userId: string;
  conversationCount: number;
  // ... other fields
};

// The output includes ALL messages from entire graph execution
// Including system messages, tool messages, etc.
```

---

## 9. Complete ReAct Agent Example

```typescript
import { StateGraph, MessagesAnnotation, MemorySaver, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 1. Define tools
const searchTool = tool(
  async ({ query }) => {
    // Call real search API
    return `Found: ${query}`;
  },
  {
    name: "search",
    description: "Search the web",
    schema: z.object({ query: z.string() }),
  }
);

// 2. Create LLM node
const llm = new ChatOpenAI({
  model: "gpt-4",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

const llmWithTools = llm.bindTools([searchTool]);

const callLlm = async (state) => {
  const response = await llmWithTools.invoke(state.messages);
  return { messages: [response] };
};

// 3. Build graph
const graph = new StateGraph(MessagesAnnotation)
  .addNode("llm", callLlm)
  .addNode("tools", new ToolNode([searchTool]))
  .addEdge(START, "llm")
  .addConditionalEdges("llm", toolsCondition, {
    tools: "tools",
    "__end__": END,
  })
  .addEdge("tools", "llm")
  .compile({ checkpointer: new MemorySaver() });

// 4. Invoke
const output = await graph.invoke(
  { messages: [new HumanMessage("What is LangGraph?")] },
  { configurable: { thread_id: "user_1" } }
);

console.log(output.messages);
```

---

## Key Takeaways

| Topic | Pattern |
|-------|---------|
| **State** | Use `MessagesAnnotation` by default; extend with `Annotation.Root({ ...MessagesAnnotation.spec, customField: ... })` |
| **Nodes** | Pure functions: `(state) => ({ messages: [...] })` or state updates |
| **Edges** | `addEdge(from, to)` for direct; `addConditionalEdges(from, routingFn, { route: node })` for branching |
| **Tools** | Use `ToolNode` + `toolsCondition` for ReAct loops |
| **Memory** | `MemorySaver` for short-term (single session); `InMemoryStore` for long-term facts |
| **Checkpointing** | Compile with `{ checkpointer: new MemorySaver() }`, invoke with `{ configurable: { thread_id } }` |
| **Custom BaseURL** | `new ChatOpenAI({ configuration: { baseURL: "..." } })` |

---

## Unresolved Questions

None identified. All core APIs verified against official LangChain documentation (langchain-ai.github.io and docs.langchain.com) with 2025-2026 examples.

---

## Sources

- [MessagesAnnotation | LangGraph.js API Reference](https://langchain-ai.github.io/langgraphjs/reference/variables/langgraph.MessagesAnnotation.html)
- [StateGraph | LangGraph.js API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html)
- [LangGraph overview - Docs by LangChain](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [Memory - Docs by LangChain](https://docs.langchain.com/oss/javascript/langgraph/add-memory)
- [ToolNode | @langchain/langgraph | LangChain Reference](https://reference.langchain.com/javascript/langchain-langgraph/prebuilt/ToolNode)
- [toolsCondition | @langchain/langgraph | LangChain Reference](https://reference.langchain.com/javascript/langchain-langgraph/prebuilt/toolsCondition)
- [ChatOpenAI integration - Docs by LangChain](https://docs.langchain.com/oss/javascript/integrations/chat/openai)
- [InMemoryStore | LangGraph.js API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.InMemoryStore.html)
- [Learning LangGraph.js Part 2: Conditional Edges | by Guy Royse](https://medium.com/the-guy-wire/learning-langgraph-js-part-2-conditional-edges-4672c35ff42f)
