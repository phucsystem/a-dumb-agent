# Research Report: Node.js Agent Frameworks for Enhancing Dumb Agent

**Date:** 2026-03-16
**Sources:** 5 (Gemini research, framework docs, npm registry, GitHub)
**Key Terms:** AI agent framework, tool use, RAG, memory, multi-agent, Node.js, TypeScript

---

## Executive Summary

Your "dumb agent" (Express + OpenAI SDK + file-based memory + markdown identity) can be significantly enhanced with modern Node.js agent frameworks. The ecosystem has matured dramatically — 6 viable frameworks exist, each with different strengths.

**Top recommendation: Vercel AI SDK** for minimal migration, or **Mastra** for full-featured agent capabilities. LangChain.js/LangGraph for complex multi-agent workflows. Avoid over-engineering — pick based on what features you actually need next.

---

## Framework Comparison

| Framework | Stars | npm/wk | Focus | Migration Difficulty |
|:---|:---|:---|:---|:---|
| **Vercel AI SDK** | 20k+ | ~2.8M | Web UX, streaming, tool use | **Very Easy** |
| **Mastra** | 19k+ | ~150k | Full-stack agents, RAG, workflows | **Moderate** |
| **LangGraph.js** | 16k+ | ~530k | Complex cycles, state mgmt | **Hard** |
| **LlamaIndex.ts** | 40k+ | ~150k | Data-heavy RAG, workflows | **Moderate** |
| **ElizaOS** | 50k+ | ~100k | Social/Web3 autonomous agents | **Niche** |
| **KaibanJS** | 5k+ | ~20k | Multi-agent orchestration | **Easy** |

### Feature Matrix

| Feature | Vercel AI SDK | Mastra | LangGraph.js | LlamaIndex.ts |
|:---|:---|:---|:---|:---|
| Tool Use | Excellent (native) | Excellent (built on AI SDK) | Good (complex API) | Good |
| Memory | Manual/external | **Built-in (SQL/Vector)** | Extensive but verbose | Semantic index |
| RAG | Basic primitives | **Integrated pipelines** | Comprehensive | **Industry leader** |
| Multi-Agent | Manual | **Graph-based workflows** | Very powerful | Event-driven |
| Structured Output | Native | Native | Via chains | Via modules |
| OpenAI-compatible APIs | Yes (provider system) | Yes (via AI SDK) | Yes (adapters) | Yes |
| DeepSeek/OpenRouter | Yes | Yes | Yes | Yes |

---

## Framework Deep Dives

### 1. Vercel AI SDK — Best for Minimal Migration

The most downloaded AI framework for JS. Provider-agnostic, streaming-first.

**Why for your agent:**
- Drop-in replacement for your `openai` SDK usage
- Adds tool use, structured output, streaming with minimal code changes
- You keep your Express server, identity system, memory system

**Code example — replacing `llm.js`:**
```typescript
import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const provider = createOpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
});

const result = await generateText({
  model: provider(process.env.LLM_MODEL),
  system: systemPrompt,
  messages: history,
  tools: {
    getWeather: tool({
      description: 'Get weather for a location',
      parameters: z.object({ location: z.string() }),
      execute: async ({ location }) => ({ temp: 72, unit: 'F' }),
    }),
  },
  prompt: userMessage,
});
```

**Limitation:** No built-in memory or RAG — you'd still manage those yourself.

---

### 2. Mastra — Best for Full Enhancement

"Next.js for Agents." Built on top of Vercel AI SDK but adds memory, RAG, workflows, observability.

**Why for your agent:**
- Has Express adapter — coexists with your current routes
- Built-in persistent memory replaces your `memory.js` entirely
- RAG pipeline out of the box
- Tool definitions are type-safe with Zod

**Code example — full agent setup:**
```typescript
import { Agent } from '@mastra/core';
import { createOpenAI } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { z } from 'zod';

const provider = createOpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
});

const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather',
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ input }) => ({ temperature: 72, unit: 'F' }),
});

const chatbot = new Agent({
  name: 'dumb-agent',
  instructions: loadIdentity(), // reuse your existing identity loader
  model: provider(process.env.LLM_MODEL),
  tools: { weatherTool },
});
```

**Memory migration:**
```typescript
import { Mastra } from '@mastra/core';
import { LibsqlStorage } from '@mastra/storage-libsql';

const mastra = new Mastra({
  storage: new LibsqlStorage({ url: 'file:memory.db' }),
  agents: { chatbot },
});

// In Express route:
app.post('/chat', async (req, res) => {
  const { message, threadId } = req.body;
  const agent = mastra.getAgent('chatbot');
  const result = await agent.generate(message, {
    threadId: threadId || 'default',
  });
  res.json({ reply: result.text });
});
```

---

### 3. LangGraph.js — Best for Complex Agent Loops

For agents that need cycles (retry until success), human-in-the-loop, complex state machines.

**Code example:**
```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o" }),
  tools: [/* tools */],
});

const response = await agent.invoke({
  messages: [{ role: "user", content: "Research tech trends." }]
});
```

**Tradeoff:** Steep learning curve, heavy abstraction layer. Overkill for simple chat agent.

---

### 4. KaibanJS — Best for Multi-Agent Teams

JS-native alternative to Python's CrewAI/AutoGen.

```typescript
import { Agent, Task, Team } from 'kaibanjs';

const researcher = new Agent({ name: 'Researcher', role: 'Fact finder' });
const writer = new Agent({ name: 'Writer', role: 'Content creator' });

const team = new Team({
  agents: [researcher, writer],
  tasks: [
    new Task({ description: 'Research topic', agent: researcher }),
    new Task({ description: 'Write summary', agent: writer }),
  ],
});

await team.start();
```

---

## Recommended Migration Path for Dumb Agent

### Option A: Minimal Enhancement (Vercel AI SDK)
Best if you only need **tool use + structured output** and want to keep things simple.

1. `npm install ai @ai-sdk/openai zod`
2. Replace `src/llm.js` with AI SDK's `generateText`
3. Define tools as needed
4. Keep your existing memory and identity systems

**Effort:** ~1 hour. **Risk:** Very low.

### Option B: Full Agent Enhancement (Mastra)
Best if you want **memory + RAG + tools + workflows** as a complete upgrade.

1. `npm install @mastra/core @ai-sdk/openai @mastra/storage-libsql zod`
2. Define Agent with your existing `loadIdentity()` as instructions
3. Replace `src/memory.js` with Mastra's built-in storage
4. Add tools incrementally
5. Add RAG when you have documents to index

**Effort:** ~4 hours. **Risk:** Low-moderate (new abstraction layer).

### Option C: Stay Dumb, Add Tools Manually
If you only need function calling, just use the OpenAI SDK's native tool support (you already have it installed).

```javascript
const response = await client.chat.completions.create({
  model,
  messages,
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      parameters: { type: 'object', properties: { location: { type: 'string' } } },
    },
  }],
});
```

**Effort:** ~30 min. **Risk:** None.

---

## Decision Matrix

| If you need... | Use... |
|:---|:---|
| Just tool calling | **Option C** (OpenAI SDK native) |
| Tool calling + streaming + structured output | **Option A** (Vercel AI SDK) |
| Full agent: memory + RAG + tools + workflows | **Option B** (Mastra) |
| Complex multi-agent orchestration | LangGraph.js or KaibanJS |
| Data-heavy RAG (lots of documents) | LlamaIndex.ts |

---

## Unresolved Questions

1. What specific capabilities do you want to add first? (tools? RAG? better memory?)
2. Do you need to maintain the "dumb" philosophy (simplicity-first) or is complexity OK?
3. Is the agent expected to be multi-tenant (many conversations) or single-user?
4. What's the target LLM provider long-term? (affects provider adapter choice)
