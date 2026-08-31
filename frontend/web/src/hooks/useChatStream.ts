import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ToolEntry } from "@/components/ToolCall";
import type {
  ChatAttachment,
  ChatMessage,
  SSEToolProgressData,
} from "@/lib/chat-types";
import { api, withBasePath, type SessionMessage } from "@/lib/api";
import { splitSSEBuffer } from "@/lib/sse-parser";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface StreamState {
  messages: ChatMessage[];
  sessionId: string | null;
  isStreaming: boolean;
  error: string | null;
}

type StreamAction =
  | { type: "SEND_USER"; userMsg: ChatMessage; assistantMsg: ChatMessage }
  | { type: "SET_SESSION_ID"; sessionId: string | null }
  | { type: "LOAD_SESSION"; sessionId: string; messages: ChatMessage[] }
  | { type: "APPEND_DELTA"; content: string }
  | { type: "UPSERT_TOOL"; toolData: SSEToolProgressData }
  | { type: "FINALIZE" }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" }
  | { type: "RESET_STREAMING" };

const initialState: StreamState = {
  messages: [],
  sessionId: null,
  isStreaming: false,
  error: null,
};

function mapStatus(
  status: SSEToolProgressData["status"]
): ToolEntry["status"] {
  switch (status) {
    case "completed":
      return "done";
    case "error":
      return "error";
    default:
      return "running";
  }
}

function reducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case "SEND_USER": {
      return {
        ...state,
        messages: [...state.messages, action.userMsg, action.assistantMsg],
        isStreaming: true,
        error: null,
      };
    }

    case "SET_SESSION_ID": {
      return { ...state, sessionId: action.sessionId };
    }

    case "LOAD_SESSION": {
      return {
        ...state,
        sessionId: action.sessionId,
        messages: action.messages,
        isStreaming: false,
        error: null,
      };
    }

    case "APPEND_DELTA": {
      if (state.messages.length === 0) return state;
      const msgs = [...state.messages];
      const last = { ...msgs[msgs.length - 1] };
      last.content = last.content + action.content;
      msgs[msgs.length - 1] = last;
      return { ...state, messages: msgs };
    }

    case "UPSERT_TOOL": {
      if (state.messages.length === 0) return state;
      const msgs = [...state.messages];
      const last = { ...msgs[msgs.length - 1] };
      const existing = last.toolCalls ?? [];
      const idx = existing.findIndex(
        (t) => t.id === action.toolData.toolCallId
      );
      const now = Date.now();
      if (idx === -1) {
        const newEntry: ToolEntry = {
          kind: "tool",
          id: action.toolData.toolCallId,
          tool_id: action.toolData.tool,
          name: action.toolData.tool,
          status: mapStatus(action.toolData.status),
          startedAt: now,
        };
        last.toolCalls = [...existing, newEntry];
      } else {
        const updated: ToolEntry = {
          ...existing[idx],
          status: mapStatus(action.toolData.status),
        };
        const newCalls = [...existing];
        newCalls[idx] = updated;
        last.toolCalls = newCalls;
      }
      msgs[msgs.length - 1] = last;
      return { ...state, messages: msgs };
    }

    case "FINALIZE": {
      return { ...state, isStreaming: false };
    }

    case "SET_ERROR": {
      return { ...state, isStreaming: false, error: action.error };
    }

    case "RESET": {
      return {
        messages: [],
        sessionId: null,
        isStreaming: false,
        error: null,
      };
    }

    case "RESET_STREAMING": {
      return { ...state, isStreaming: false };
    }

    default: {
      // Exhaustive check — TypeScript will error if a case is missing
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseChatStreamReturn {
  messages: ChatMessage[];
  sessionId: string | null;
  isStreaming: boolean;
  error: string | null;
  send: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  ensureSessionId: () => string;
  loadSession: (sessionId: string) => Promise<void>;
  reset: () => void;
  abort: () => void;
}

const ATTACHMENTS_OPEN = "[[NEYRA_ATTACHMENTS_JSON]]";
const ATTACHMENTS_CLOSE = "[[/NEYRA_ATTACHMENTS_JSON]]";
const ATTACHMENT_INSTRUCTIONS_OPEN = "[[NEYRA_ATTACHMENT_INSTRUCTIONS]]";
const ATTACHMENT_INSTRUCTIONS_CLOSE = "[[/NEYRA_ATTACHMENT_INSTRUCTIONS]]";

function attachmentInstructions(attachments: ChatAttachment[]): string {
  const rows = attachments.map((attachment, index) => {
    const base = `${index + 1}. «${attachment.name}» (${attachment.mime}, ${attachment.size} байт): ${attachment.agentPath}`;
    if (attachment.kind === "voice" || attachment.kind === "audio") {
      return attachment.transcript
        ? `${base}\n   Распознанный текст: ${attachment.transcript}`
        : `${base}\n   Это аудиофайл пользователя.`;
    }
    if (attachment.kind === "image") {
      return `${base}\n   При необходимости исследуй изображение инструментом анализа изображений.`;
    }
    return `${base}\n   При необходимости открой и исследуй этот документ доступными файловыми инструментами.`;
  });
  return [
    "Пользователь приложил локальные файлы. Пути ниже относятся к рабочему контейнеру Нэйры.",
    ...rows,
  ].join("\n");
}

function serializeChatContent(text: string, attachments: ChatAttachment[]): string {
  if (attachments.length === 0) return text;
  const metadata = JSON.stringify(attachments);
  const parts = [text.trim()];
  parts.push(
    `${ATTACHMENTS_OPEN}\n${metadata}\n${ATTACHMENTS_CLOSE}`,
    `${ATTACHMENT_INSTRUCTIONS_OPEN}\n${attachmentInstructions(attachments)}\n${ATTACHMENT_INSTRUCTIONS_CLOSE}`,
  );
  return parts.filter(Boolean).join("\n\n");
}

function parseStoredChatContent(content: string): {
  text: string;
  attachments: ChatAttachment[];
} {
  const metadataPattern = new RegExp(
    `${ATTACHMENTS_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)\\n${ATTACHMENTS_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
  );
  const match = content.match(metadataPattern);
  let attachments: ChatAttachment[] = [];
  if (match?.[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) attachments = parsed as ChatAttachment[];
    } catch {
      attachments = [];
    }
  }
  const instructionsPattern = new RegExp(
    `${ATTACHMENT_INSTRUCTIONS_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n[\\s\\S]*?\\n${ATTACHMENT_INSTRUCTIONS_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
  );
  return {
    text: content.replace(metadataPattern, "").replace(instructionsPattern, "").trim(),
    attachments,
  };
}

function sessionMessageToChatMessage(
  sessionId: string,
  message: SessionMessage,
  index: number
): ChatMessage | null {
  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }

  const parsed = parseStoredChatContent(message.content ?? "");
  return {
    id: `${sessionId}-${index}`,
    role: message.role,
    content: parsed.text,
    timestamp: message.timestamp ?? Date.now(),
    attachments: parsed.attachments,
  };
}

export function useChatStream(): UseChatStreamReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // Synchronous mirror of state.isStreaming so concurrent send() calls
  // can guard against re-entry without waiting for a re-render. React
  // state updates are async — without this ref, two send() calls fired
  // in the same event loop tick would both see isStreaming=false and
  // race: a second AbortController would overwrite the first one,
  // orphaning the first reader, which would keep dispatching
  // APPEND_DELTA into the wrong (newly-created) assistant message.
  // Codex stop-gate review #7 caught this.
  const streamingRef = useRef(false);
  // Identifier of the stream currently allowed to mutate state. send()
  // sets this to the session UUID it created/uses, and the read loop
  // checks it before every dispatch. If loadSession()/reset() flips it
  // (to null or another id), the in-flight stream sees a mismatch on its
  // next iteration and bails out cleanly — preventing APPEND_DELTA from
  // landing in a freshly-loaded thread or post-reset empty state.
  // (Codex stop-gate review #10.)
  const activeStreamIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    const sessionId = activeStreamIdRef.current;
    if (sessionId) {
      const token =
        typeof window !== "undefined"
          ? (window.__NEYRA_SESSION_TOKEN__ ?? "")
          : "";
      void fetch(withBasePath("/api/chat/stop"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => undefined);
    }
    abortControllerRef.current?.abort();
  }, []);

  const ensureSessionId = useCallback((): string => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    dispatch({ type: "SET_SESSION_ID", sessionId });
    return sessionId;
  }, []);

  const loadSession = useCallback(async (sessionId: string): Promise<void> => {
    // Invalidate any in-flight stream before mutating state. Triple guard:
    // (1) activeStreamIdRef flip — read loop checks this synchronously on
    //     every iteration and bails out before dispatching APPEND_DELTA,
    // (2) abort() — propagates AbortError so the catch block runs cleanup,
    // (3) streamingRef=false — releases the concurrent-send lock so the
    //     user can immediately send into the loaded thread.
    // (Codex stop-gate review #10.)
    activeStreamIdRef.current = null;
    abortControllerRef.current?.abort();
    streamingRef.current = false;
    sessionIdRef.current = sessionId;

    try {
      const resp = await api.getSessionMessages(sessionId);
      const chatMessages = resp.messages
        .map((message, index) =>
          sessionMessageToChatMessage(sessionId, message, index)
        )
        .filter((message): message is ChatMessage => message !== null);

      dispatch({ type: "LOAD_SESSION", sessionId, messages: chatMessages });

      // Legacy/compressed sessions return an empty (or system-only) message
      // list — without feedback the user sees a blank transcript and assumes
      // the resume= link is broken. Surface a soft warning that lets them
      // continue the thread from here. (Codex stop-gate review #13.)
      if (chatMessages.length === 0) {
        dispatch({
          type: "SET_ERROR",
          error:
            "История этой сессии недоступна (сжата или legacy). Можешь продолжить отсюда — следующее сообщение запишется в эту нить.",
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Не удалось загрузить сессию: ${err.message}`
          : "Не удалось загрузить сессию";
      dispatch({ type: "SET_ERROR", error: msg });
    }
  }, []);

  const reset = useCallback(() => {
    // Same triple-guard as loadSession — abort any active stream so its
    // residual APPEND_DELTAs don't leak into the new chat.
    activeStreamIdRef.current = null;
    abortControllerRef.current?.abort();
    streamingRef.current = false;
    sessionIdRef.current = null;

    dispatch({ type: "RESET" });
  }, []);

  const send = useCallback(
    async (text: string, attachments: ChatAttachment[] = []): Promise<void> => {
      // Reject concurrent sends. The composer UI already swaps Send for
      // Stop while streaming, but Enter-key submits bypass the swap, and
      // programmatic callers (tests, plugins) can call send() directly.
      // This ref-based guard is the source of truth.
      if (streamingRef.current) return;
      streamingRef.current = true;

      const sessionId = ensureSessionId();
      // Tag this stream as the one currently allowed to mutate state.
      // The read loop below re-checks this ref on every iteration so a
      // mid-stream loadSession()/reset() can invalidate us synchronously.
      const localStreamId = sessionId;
      activeStreamIdRef.current = localStreamId;

      // Build user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
        attachments,
      };

      const assistantMsg: ChatMessage = {
        id: "asst-" + crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      dispatch({ type: "SEND_USER", userMsg, assistantMsg });

      // Snapshot current history for the request body
      // We append the new user message so the server sees it
      const historyMessages = [
        ...state.messages.map((m) => ({
          role: m.role,
          content: serializeChatContent(m.content, m.attachments ?? []),
        })),
        {
          role: userMsg.role,
          content: serializeChatContent(userMsg.content, attachments),
        },
      ];

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const token =
        typeof window !== "undefined"
          ? (window.__NEYRA_SESSION_TOKEN__ ?? "")
          : "";

      try {
        const response = await fetch(withBasePath("/api/chat/completions"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // canary 0.15 loopback auth expects Bearer <ephemeral session token>
            Authorization: `Bearer ${token}`,
            "X-Neyra-Session-Id": sessionId,
          },
          body: JSON.stringify({
            model: "neyra-agent",
            messages: historyMessages,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => response.statusText);
          // Don't touch streamingRef/isStreaming if a newer send() (or
          // loadSession/reset) already invalidated us — those paths
          // already manage the lock and dispatching here would unlock
          // the *next* stream mid-flight. (Codex review #11.)
          if (
            mountedRef.current &&
            activeStreamIdRef.current === localStreamId
          ) {
            activeStreamIdRef.current = null;
            streamingRef.current = false;
            dispatch({ type: "SET_ERROR", error: `${response.status}: ${errText}` });
          }
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder("utf-8", { fatal: false });
        let buffer = "";
        // The `done` SSE event tells us the upstream considers itself
        // finished. Don't dispatch FINALIZE inline — wait until the reader
        // loop has actually exited so we can release the ref-lock and
        // signal isStreaming=false atomically (Codex review #9). Setting
        // FINALIZE while still inside `await reader.read()` opens a
        // window where (a) UI re-renders with isStreaming=false, (b) ref
        // is false too, (c) user starts a new send, (d) the old reader
        // is still alive and would write APPEND_DELTA into the new
        // assistant message — corrupting state (review #7 in disguise).
        let sawDone = false;
        let sawTerminalError = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { events, remainder } = splitSSEBuffer(buffer);
          buffer = remainder;

          if (!mountedRef.current) {
            reader.cancel();
            return;
          }
          // If loadSession/reset invalidated our stream, abandon quietly.
          // Don't dispatch any of the events we just decoded — they belong
          // to a thread the user has already navigated away from.
          if (activeStreamIdRef.current !== localStreamId) {
            void reader.cancel();
            return;
          }

          for (const event of events) {
            if (!mountedRef.current) break;
            if (activeStreamIdRef.current !== localStreamId) break;
            if (event.type === "chunk") {
              const choice = event.data.choices[0];
              const content = choice?.delta?.content ?? "";
              if (content) {
                dispatch({ type: "APPEND_DELTA", content });
              }
              if (choice?.finish_reason === "error") {
                activeStreamIdRef.current = null;
                streamingRef.current = false;
                dispatch({
                  type: "SET_ERROR",
                  error: "Agent stream ended with an error",
                });
                sawTerminalError = true;
                void reader.cancel();
                break;
              }
            } else if (event.type === "tool_progress") {
              dispatch({ type: "UPSERT_TOOL", toolData: event.data });
            } else if (event.type === "done") {
              // Just record that we saw [DONE]. The atomic finalize
              // happens after the reader actually terminates below.
              sawDone = true;
            }
          }

          if (sawTerminalError) {
            break;
          }

          if (sawDone) {
            // Tear down the reader explicitly so the next read() call
            // returns {done: true} promptly and we exit the loop. If we
            // didn't cancel, an unfinished upstream might keep us here
            // arbitrarily.
            void reader.cancel();
            break;
          }
        }

        // Reader is now terminal (server closed, or we cancelled after
        // [DONE], or the network ended the stream). Release the ref-lock
        // and dispatch FINALIZE in the SAME synchronous span so React
        // sees both changes in one commit (review #8) and there is no
        // residual reader work that could write into a new message
        // (review #9). Skip if this stream was already invalidated by
        // loadSession/reset (review #10) — those paths already cleared
        // state and would re-flip isStreaming spuriously.
        if (mountedRef.current && activeStreamIdRef.current === localStreamId) {
          activeStreamIdRef.current = null;
          streamingRef.current = false;
          dispatch({ type: "FINALIZE" });
        }
      } catch (err) {
        if (!mountedRef.current) return;
        // If our stream was invalidated (loadSession/reset, or a newer
        // send() somehow), the AbortError lands here — but the locks
        // and state already belong to the *new* stream. Silent return.
        // (Codex review #11.)
        if (activeStreamIdRef.current !== localStreamId) return;

        // Drop ref-lock before any dispatch that flips state.isStreaming so
        // the UI re-render and the lock release happen in the same React
        // commit boundary. (Codex review #8.)
        activeStreamIdRef.current = null;
        streamingRef.current = false;
        if (err instanceof Error && err.name === "AbortError") {
          dispatch({ type: "RESET_STREAMING" });
        } else {
          dispatch({ type: "SET_ERROR", error: "Connection lost" });
          dispatch({ type: "RESET_STREAMING" });
        }
      } finally {
        // Defensive cleanup — only unlock if this stream is still the
        // active one. If invalidated, the new stream owns the lock and
        // we must not touch it. (Codex review #11.)
        if (activeStreamIdRef.current === localStreamId) {
          activeStreamIdRef.current = null;
          streamingRef.current = false;
        }
      }
    },
    [ensureSessionId, state.messages]
  );

  return {
    messages: state.messages,
    sessionId: state.sessionId,
    isStreaming: state.isStreaming,
    error: state.error,
    send,
    ensureSessionId,
    loadSession,
    reset,
    abort,
  };
}
