import "dotenv/config";

import crypto from "node:crypto";
import express from "express";
import { loadIdentity } from "./identity.js";
import { invokeAgent } from "./graph.js";
import type {
  ChatRequest,
  WebhookRequest,
  AgentResponse,
  HealthResponse,
} from "./types.js";

const AUTH_TOKEN = process.env.AUTH_TOKEN;
if (!AUTH_TOKEN) {
  console.error("FATAL: AUTH_TOKEN is not set. Exiting.");
  process.exit(1);
}
if (!process.env.LLM_API_KEY) {
  console.error("FATAL: LLM_API_KEY is not set. Exiting.");
  process.exit(1);
}

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000", 10);
const startTime = Date.now();

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(AUTH_TOKEN!);
  if (
    tokenBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.use(authMiddleware);

app.post("/chat", async (req, res) => {
  const { message, sender } = req.body as ChatRequest;

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const systemPrompt = loadIdentity();
    const reply = await invokeAgent(message, {
      threadId: "default",
      systemPrompt,
      sender: sender || "unknown",
    });
    const timestamp = new Date().toISOString();

    console.log(
      `[${timestamp}] sender=${sender || "unknown"} message="${message.substring(0, 80)}"`
    );

    const response: AgentResponse = { reply, agent: "dumb-agent", timestamp };
    res.json(response);
  } catch (error) {
    console.error("Chat error:", (error as Error).message);
    res.status(500).json({ error: "LLM request failed" });
  }
});

app.post("/webhook", express.json({ type: "*/*" }), async (req, res) => {
  const {
    event,
    message: msg,
    conversation,
  } = (req.body || {}) as WebhookRequest;

  if (!msg || !msg.content) {
    res.status(400).json({ error: "message.content is required" });
    return;
  }

  if (msg.sender_is_agent) {
    res.json({ skipped: true, reason: "ignoring agent messages" });
    return;
  }

  const conversationId = conversation?.id || msg?.conversation_id;
  const senderName = msg.sender_name || msg.sender_id || "unknown";
  const content = msg.content;

  try {
    const systemPrompt = loadIdentity();
    const reply = await invokeAgent(content, {
      threadId: conversationId || "default",
      systemPrompt,
      sender: senderName,
    });
    const timestamp = new Date().toISOString();

    console.log(
      `[${timestamp}] webhook event=${event} conversation=${conversationId} sender=${senderName} message="${content.substring(0, 80)}"`
    );

    const response: AgentResponse = {
      reply,
      agent: "dumb-agent",
      conversation_id: conversationId,
      timestamp,
    };
    res.json(response);
  } catch (error) {
    console.error("Webhook error:", (error as Error).message);
    res.status(500).json({ error: "LLM request failed" });
  }
});

app.get("/health", (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const response: HealthResponse = {
    status: "ok",
    agent: "dumb-agent",
    provider: process.env.LLM_PROVIDER || "deepseek",
    uptime: uptimeSeconds,
    langgraph: true,
  };
  res.json(response);
});

app.listen(PORT, () => {
  console.log(`Dumb Agent listening on port ${PORT}`);
  console.log(`Provider: ${process.env.LLM_PROVIDER || "deepseek"}`);
  console.log(`Model: ${process.env.LLM_MODEL || "deepseek-chat"}`);
  console.log("Backend: LangGraph.js");
});
