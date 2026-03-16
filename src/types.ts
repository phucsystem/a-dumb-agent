import type { BaseMessage } from "@langchain/core/messages";

export interface ChatRequest {
  message: string;
  sender?: string;
}

export interface WebhookRequest {
  event?: string;
  message: {
    content: string;
    sender_name?: string;
    sender_id?: string;
    sender_is_agent?: boolean;
    conversation_id?: string;
  };
  conversation?: {
    id?: string;
  };
}

export interface AgentResponse {
  reply: string;
  agent: string;
  timestamp: string;
  conversation_id?: string;
}

export interface HealthResponse {
  status: string;
  agent: string;
  provider: string;
  uptime: number;
  langgraph: boolean;
}
