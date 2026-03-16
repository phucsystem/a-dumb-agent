import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
  MemorySaver,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import { loadIdentity } from "./identity.js";
import { getStore, getUserFacts } from "./memory.js";
import { tools } from "./tools.js";

const AgentAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  systemPrompt: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  sender: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "unknown",
  }),
});

const model = new ChatOpenAI({
  model: process.env.LLM_MODEL || "deepseek-chat",
  apiKey: process.env.LLM_API_KEY,
  configuration: {
    baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
  },
});

async function agentNode(
  state: typeof AgentAnnotation.State
): Promise<Partial<typeof AgentAnnotation.State>> {
  const store = getStore();
  const senderId = state.sender || "unknown";

  let systemContent = state.systemPrompt;

  const facts = await getUserFacts(store, senderId, 5);
  if (facts.length > 0) {
    systemContent +=
      "\n\nKnown about this user:\n" +
      facts.map((fact) => `- ${fact}`).join("\n");
  }

  const systemMessage = new SystemMessage(systemContent);
  const allMessages: BaseMessage[] = [systemMessage, ...state.messages];

  const modelWithTools =
    tools.length > 0 ? model.bindTools(tools) : model;

  const response = await modelWithTools.invoke(allMessages);

  return { messages: [response] };
}

export function createGraph() {
  const checkpointer = new MemorySaver();
  const store = getStore();

  const builder = new StateGraph(AgentAnnotation)
    .addNode("agent", agentNode)
    .addEdge(START, "agent");

  if (tools.length > 0) {
    builder
      .addNode("tools", new ToolNode(tools))
      .addConditionalEdges("agent", toolsCondition, {
        tools: "tools",
        __end__: END,
      })
      .addEdge("tools", "agent");
  } else {
    builder.addEdge("agent", END);
  }

  return builder.compile({ checkpointer, store });
}

let graphInstance: ReturnType<typeof createGraph> | null = null;

export function getGraph() {
  if (!graphInstance) {
    graphInstance = createGraph();
  }
  return graphInstance;
}

export async function invokeAgent(
  message: string,
  config: { threadId: string; systemPrompt?: string; sender?: string }
): Promise<string> {
  const graph = getGraph();

  const result = await graph.invoke(
    {
      messages: [new HumanMessage(message)],
      systemPrompt: config.systemPrompt || loadIdentity(),
      sender: config.sender || "unknown",
    },
    { configurable: { thread_id: config.threadId } }
  );

  const lastMessage = result.messages[result.messages.length - 1];
  const content = lastMessage?.content;

  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return typeof content === "string"
    ? content
    : JSON.stringify(content);
}
