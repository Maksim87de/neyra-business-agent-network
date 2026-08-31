import type { ToolEntry } from "@/components/ToolCall";

export type ChatRole = "user" | "assistant";

export type ChatAttachmentKind = "file" | "image" | "audio" | "voice";

export interface ChatAttachment {
  id: string;
  sessionId: string;
  name: string;
  size: number;
  mime: string;
  kind: ChatAttachmentKind;
  agentPath: string;
  transcript?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolEntry[];
  attachments?: ChatAttachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessageAt: number;
}

/** OpenAI-compatible chat completion chunk */
export interface SSEChatChunkData {
  id: string;
  object: "chat.completion.chunk";
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: ChatRole; content?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Neyra-specific tool progress event */
export interface SSEToolProgressData {
  tool: string;
  toolCallId: string;
  status: "running" | "completed" | "error";
  emoji?: string;
  label?: string;
}

/** Discriminated union for SSE parser output */
export type SSEEvent =
  | { type: "chunk"; data: SSEChatChunkData }
  | { type: "tool_progress"; data: SSEToolProgressData }
  | { type: "done" };
