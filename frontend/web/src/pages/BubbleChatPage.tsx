/**
 * BubbleChatPage — production client chat with live SSE streaming.
 *
 * Three-column layout: thread list · transcript · composer.
 *
 * The composer talks to `/api/chat/completions`, streams responses back via
 * SSE and renders tool progress. Session continuity uses X-Neyra-Session-Id;
 * the sidebar is backed by the real session database.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Send,
  MessageSquare,
  MessageCircle,
  Terminal,
  Globe,
  BotMessageSquare,
  Square,
  X,
  Copy,
  Check,
  Paperclip,
  Mic,
  AudioLines,
  FileText,
  Image as ImageIcon,
  Download,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import type { ComponentType } from "react";

import { Markdown } from "@/components/Markdown";
import { ToolCall } from "@/components/ToolCall";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { cn } from "@/lib/utils";
import type {
  ChatAttachment,
  ChatAttachmentKind,
  ChatMessage,
} from "@/lib/chat-types";
import { api, type SessionInfo } from "@/lib/api";
import { useChatStream } from "@/hooks/useChatStream";
import { useSessionList } from "@/hooks/useSessionList";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";

/* ------------------------------------------------------------------ */
/*  Re-exports                                                         */
/* ------------------------------------------------------------------ */

// Shared chat types live in @/lib/chat-types — re-exported here for any
// consumer that still imports them from this module.
export type { ChatRole, ChatMessage, ChatSession } from "@/lib/chat-types";

/* ------------------------------------------------------------------ */
/*  Source → icon mapping (Telegram, api_server, cli, …)               */
/* ------------------------------------------------------------------ */

const SOURCE_ICON: Record<string, ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>> = {
  telegram: MessageCircle,
  api_server: BotMessageSquare,
  cli: Terminal,
  discord: MessageSquare,
  slack: MessageSquare,
  whatsapp: Globe,
};

function iconForSource(source: string | null): ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }> {
  if (!source) return MessageSquare;
  return SOURCE_ICON[source] ?? MessageSquare;
}

function titleFor(session: SessionInfo): string {
  if (session.title) return session.title;
  if (session.preview) return session.preview.slice(0, 60);
  return "Без названия";
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// Neyra session timestamps (SessionInfo.last_active) are Unix epoch SECONDS,
// not milliseconds. Counting via Date.now()-ts treats them as ms → off by
// 1000× → "20570 days ago" for fresh sessions. Дмитрий caught it after
// Phase 2.5.b takeover. Use same convention as @/lib/utils#timeAgo.
function formatRelative(tsSec: number): string {
  const deltaSec = Date.now() / 1000 - tsSec;
  if (deltaSec < 60) return "только что";
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)} мин назад`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)} ч назад`;
  if (deltaSec < 172800) return "вчера";
  return `${Math.floor(deltaSec / 86400)} д назад`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function attachmentKindForFile(file: File): ChatAttachmentKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/") || /\.(aac|flac|m4a|mp3|mp4|ogg|wav|webm)$/i.test(file.name)) {
    return "audio";
  }
  return "file";
}

function ChatAttachmentCard({ attachment }: { attachment: ChatAttachment }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    attachment.kind === "image" || attachment.kind === "audio" || attachment.kind === "voice",
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!(["image", "audio", "voice"] as ChatAttachmentKind[]).includes(attachment.kind)) {
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    api.fetchChatAttachmentBlob(attachment)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  const download = useCallback(async () => {
    try {
      const blob = await api.fetchChatAttachmentBlob(attachment);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    }
  }, [attachment]);

  if (attachment.kind === "image" && objectUrl) {
    return (
      <div className="overflow-hidden rounded-lg border border-current/15 bg-black/5">
        <img
          src={objectUrl}
          alt={attachment.name}
          className="max-h-72 w-full object-contain"
        />
        <button type="button" onClick={download} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-black/5">
          <Download size={13} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{attachment.name}</span>
          <span className="opacity-60">{formatBytes(attachment.size)}</span>
        </button>
      </div>
    );
  }

  if ((attachment.kind === "audio" || attachment.kind === "voice") && objectUrl) {
    return (
      <div className="min-w-[240px] rounded-lg border border-current/15 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-2 text-xs">
          <AudioLines size={14} aria-hidden />
          <span>{attachment.kind === "voice" ? "Голосовое сообщение" : attachment.name}</span>
          <span className="ml-auto opacity-60">{formatBytes(attachment.size)}</span>
        </div>
        <audio controls preload="metadata" src={objectUrl} className="h-8 w-full" />
        {attachment.transcript && (
          <p className="mt-2 border-t border-current/10 pt-2 text-xs leading-relaxed opacity-75">
            {attachment.transcript}
          </p>
        )}
      </div>
    );
  }

  const Icon = attachment.kind === "image" ? ImageIcon : attachment.kind === "file" ? FileText : AudioLines;
  return (
    <button
      type="button"
      onClick={download}
      className="flex w-full min-w-[220px] items-center gap-2 rounded-lg border border-current/15 px-3 py-2 text-xs hover:bg-black/5"
    >
      {loading ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : <Icon size={15} aria-hidden />}
      <span className="min-w-0 flex-1 truncate text-left">{attachment.name}</span>
      <span className="opacity-60">{error ? "Ошибка" : formatBytes(attachment.size)}</span>
      <Download size={13} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  UserBubble                                                         */
/* ------------------------------------------------------------------ */

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[80%] rounded-md px-3 py-2",
          "bg-primary/15 text-foreground border border-primary/30",
          // Chat content must be readable — opt out of Neyra's UPPERCASE body style.
          "font-sans normal-case tracking-normal",
        )}
      >
        {message.attachments && message.attachments.length > 0 && (
          <div className={cn("space-y-2", message.content && "mb-2")}>
            {message.attachments.map((attachment) => (
              <ChatAttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
        {message.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AssistantBubble                                                    */
/* ------------------------------------------------------------------ */

function AssistantBubble({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  const hasTools = message.toolCalls && message.toolCalls.length > 0;
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts — silent.
    }
  }, [message.content]);

  return (
    <div className="group flex justify-start">
      <div
        className={cn(
          "relative max-w-[85%] rounded-md px-3 py-2",
          "bg-card border border-border",
          // Chat content must be readable — opt out of Neyra's UPPERCASE body style.
          "font-sans normal-case tracking-normal",
        )}
      >
        {hasTools && (
          <div className="mb-2 space-y-1">
            {message.toolCalls!.map((tool) => (
              <ToolCall key={tool.id} tool={tool} />
            ))}
          </div>
        )}
        {message.content && (
          <Markdown content={message.content} streaming={streaming} />
        )}
        {/* Copy button — visible on hover. Streaming bubbles still get one
            (you can grab whatever has already arrived). */}
        {message.content && !streaming && (
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              "absolute top-1 right-1 rounded-md p-1",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "hover:bg-muted/40 text-muted-foreground",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
            )}
            aria-label={copied ? "Скопировано" : "Скопировать"}
            title={copied ? "Скопировано" : "Скопировать"}
          >
            {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BubbleChatSidebar                                                  */
/* ------------------------------------------------------------------ */

interface BubbleChatSidebarProps {
  sessions: SessionInfo[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRequestDelete: (id: string) => void;
}

function BubbleChatSidebar({
  sessions,
  activeId,
  loading,
  error,
  onSelect,
  onNewChat,
  onRequestDelete,
}: BubbleChatSidebarProps) {
  return (
    // No bg- override — let the parent dashboard background show through.
    // Only border-r separates the sidebar from the transcript area.
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border">
      <div className="p-2 border-b border-border">
        <button
          type="button"
          onClick={onNewChat}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2",
            "rounded-md border border-border bg-background",
            "hover:opacity-90 active:opacity-100",
            "font-mondwest text-[0.8rem] tracking-[0.12em] uppercase",
            "transition-opacity",
          )}
        >
          <Plus size={14} aria-hidden />
          <span>Новый чат</span>
        </button>
      </div>
      <nav
        aria-label="Список чатов"
        className="flex-1 overflow-y-auto py-1"
      >
        {loading && sessions.length === 0 && (
          <p className="px-5 py-2 text-xs opacity-60 font-mondwest tracking-[0.08em]">
            Загрузка…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="px-5 py-2 text-xs text-destructive font-mondwest tracking-[0.08em]"
          >
            {error}
          </p>
        )}
        {sessions.map((s) => {
          const active = s.id === activeId;
          const Icon = iconForSource(s.source);
          return (
            <div
              key={s.id}
              className={cn(
                "group relative w-full",
                "transition-opacity",
                active ? "text-midground" : "opacity-60 hover:opacity-100",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={cn(
                  "relative w-full text-left",
                  "px-5 py-2.5 pr-9 flex items-start gap-2.5",
                  "cursor-pointer",
                  "font-mondwest text-[0.8rem] tracking-[0.08em]",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-px bg-midground"
                    style={{ mixBlendMode: "plus-lighter" }}
                  />
                )}
                <span
                  aria-hidden
                  className="absolute inset-y-0.5 left-1.5 right-1.5 bg-midground opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-5"
                />
                <Icon
                  size={12}
                  className="mt-1 shrink-0 relative"
                  aria-hidden
                />
                <span className="flex-1 min-w-0 relative">
                  <span className="block truncate">{titleFor(s)}</span>
                  <span className="block text-[0.65rem] tracking-normal opacity-60 mt-0.5 normal-case">
                    {formatRelative(s.last_active)}
                  </span>
                </span>
              </button>
              {/* Delete button — shows on hover only. Stopping propagation so
                  clicking X doesn't also select the session. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete(s.id);
                }}
                className={cn(
                  "absolute top-1/2 right-2 -translate-y-1/2",
                  "rounded-md p-1",
                  "opacity-0 group-hover:opacity-60 hover:!opacity-100",
                  "hover:bg-destructive/20 hover:text-destructive",
                  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
                  "transition-opacity",
                )}
                aria-label={`Удалить чат «${titleFor(s)}»`}
                title="Удалить чат"
              >
                <X size={12} aria-hidden />
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  BubbleChatTranscript                                               */
/* ------------------------------------------------------------------ */

function BubbleChatTranscript({
  messages,
  streaming,
  error,
}: {
  messages: ChatMessage[];
  streaming?: boolean;
  error?: string | null;
}) {
  // Mark the last assistant message as streaming so Markdown shows a caret.
  const lastIdx = messages.length - 1;
  const lastIsAssistant =
    lastIdx >= 0 && messages[lastIdx]!.role === "assistant";

  // Autoscroll to the bottom whenever a new message is added or the last
  // message's content grows during streaming. We scroll the container
  // directly — scrollIntoView's "closest scrollable ancestor" search was
  // unreliable in our flex layout. useLayoutEffect runs synchronously
  // AFTER the DOM is updated but BEFORE the browser paints, so we always
  // see the newest scrollHeight (no need for requestAnimationFrame, which
  // additionally was flaky in headless Chromium during tests).
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastContentLen = messages[lastIdx]?.content.length ?? 0;
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, lastContentLen, error]);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
            <p className="text-lg text-foreground font-sans font-medium normal-case tracking-normal">
              Нэйра на связи
            </p>
            <p className="text-sm text-muted-foreground font-sans normal-case tracking-normal">
              Напишите сообщение, приложите документ или запишите голосовое.
            </p>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <UserBubble key={m.id} message={m} />
            ) : (
              <AssistantBubble
                key={m.id}
                message={m}
                streaming={
                  streaming === true && lastIsAssistant && i === lastIdx
                }
              />
            ),
          )
        )}
        {error && (
          <div className="flex justify-center">
            <p
              role="alert"
              className={cn(
                "text-xs rounded-md px-3 py-2 max-w-md text-center",
                "bg-destructive/10 text-destructive border border-destructive/30",
                "font-sans normal-case tracking-normal",
              )}
            >
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BubbleChatComposer                                                 */
/* ------------------------------------------------------------------ */

interface BubbleChatComposerProps {
  disabled?: boolean;
  streaming?: boolean;
  ensureSessionId: () => string;
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onAbort?: () => void;
}

type PendingStatus = "queued" | "uploading" | "transcribing" | "ready" | "error";

interface PendingUpload {
  localId: string;
  name: string;
  size: number;
  status: PendingStatus;
  progress: number;
  attachment?: ChatAttachment;
  error?: string;
}

const CHAT_UPLOAD_MAX_FILES = 20;
const CHAT_UPLOAD_MAX_FILE_BYTES = 100 * 1024 * 1024;
const CHAT_UPLOAD_MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const CHAT_UPLOAD_CONCURRENCY = 3;

const CHAT_FILE_ACCEPT = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".md",
  ".rtf", ".odt", ".ods", ".ppt", ".pptx", ".json", ".xml",
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".mp3", ".m4a", ".wav", ".ogg", ".webm", ".aac", ".flac", ".mp4",
].join(",");

function BubbleChatComposer({
  disabled,
  streaming,
  ensureSessionId,
  onSend,
  onAbort,
}: BubbleChatComposerProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const pendingRef = useRef<PendingUpload[]>([]);

  pendingRef.current = pending;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") recorder.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      for (const item of pendingRef.current) {
        if (item.attachment) void api.deleteChatAttachment(item.attachment).catch(() => undefined);
      }
    };
  }, []);

  const patchPending = useCallback(
    (localId: string, patch: Partial<PendingUpload>) => {
      const next = pendingRef.current.map((item) => (
        item.localId === localId ? { ...item, ...patch } : item
      ));
      pendingRef.current = next;
      setPending(next);
    },
    [],
  );

  const transcribePending = useCallback(async (
    localId: string,
    attachment: ChatAttachment,
  ) => {
    patchPending(localId, { status: "transcribing", attachment, error: undefined });
    try {
      const result = await api.transcribeChatAttachment(attachment);
      if (!mountedRef.current) return;
      patchPending(localId, {
        status: "ready",
        attachment: { ...attachment, transcript: result.transcript },
      });
    } catch {
      if (!mountedRef.current) return;
      patchPending(localId, {
        status: "error",
        attachment,
        error: "Не удалось распознать речь",
      });
    }
  }, [patchPending]);

  const uploadFiles = useCallback(async (
    files: File[],
    forcedKind?: ChatAttachmentKind,
  ) => {
    setComposerError(null);
    if (files.length === 0) return;

    const existing = pendingRef.current;
    if (existing.length + files.length > CHAT_UPLOAD_MAX_FILES) {
      setComposerError(
        `Можно приложить не более ${CHAT_UPLOAD_MAX_FILES} файлов. ` +
        `Уже добавлено: ${existing.length}, выбрано: ${files.length}.`,
      );
      return;
    }

    const emptyFile = files.find((file) => file.size === 0);
    if (emptyFile) {
      setComposerError(`Файл «${emptyFile.name}» пустой.`);
      return;
    }

    const oversizedFile = files.find((file) => file.size > CHAT_UPLOAD_MAX_FILE_BYTES);
    if (oversizedFile) {
      setComposerError(`Файл «${oversizedFile.name}» больше 100 МБ.`);
      return;
    }

    const existingBytes = existing.reduce((total, item) => total + item.size, 0);
    const selectedBytes = files.reduce((total, file) => total + file.size, 0);
    if (existingBytes + selectedBytes > CHAT_UPLOAD_MAX_TOTAL_BYTES) {
      setComposerError(
        `Общий размер вложений не должен превышать 500 МБ. ` +
        `Сейчас получится ${formatBytes(existingBytes + selectedBytes)}.`,
      );
      return;
    }

    const jobs = files.map((file) => {
      const item: PendingUpload = {
        localId: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        status: "queued",
        progress: 0,
      };
      return { file, item, kind: forcedKind ?? attachmentKindForFile(file) };
    });

    const additions = jobs.map((job) => job.item);
    pendingRef.current = [...existing, ...additions];
    setPending(pendingRef.current);

    const sessionId = ensureSessionId();
    let nextJob = 0;
    const worker = async () => {
      while (nextJob < jobs.length) {
        const job = jobs[nextJob++];
        patchPending(job.item.localId, { status: "uploading", progress: 0, error: undefined });
        try {
          const attachment = await api.uploadChatAttachment(
            sessionId,
            job.file,
            job.kind,
            (progress) => patchPending(job.item.localId, { progress }),
          );
          if (!mountedRef.current) return;
          if (job.kind === "voice" || job.kind === "audio") {
            await transcribePending(job.item.localId, attachment);
          } else {
            patchPending(job.item.localId, { status: "ready", progress: 100, attachment });
          }
        } catch (error) {
          if (!mountedRef.current) return;
          patchPending(job.item.localId, {
            status: "error",
            error: error instanceof Error ? error.message : "Не удалось загрузить файл",
          });
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(CHAT_UPLOAD_CONCURRENCY, jobs.length) },
        () => worker(),
      ),
    );
  }, [ensureSessionId, patchPending, transcribePending]);

  const removePending = useCallback((item: PendingUpload) => {
    pendingRef.current = pendingRef.current.filter((candidate) => candidate.localId !== item.localId);
    setPending((items) => items.filter((candidate) => candidate.localId !== item.localId));
    if (item.attachment) {
      void api.deleteChatAttachment(item.attachment).catch(() => undefined);
    }
  }, []);

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setComposerError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setComposerError("Этот браузер не поддерживает запись голосовых сообщений.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingTimerRef.current !== null) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        if (!mountedRef.current) return;
        setRecording(false);
        const mime = recorder.mimeType || "audio/webm";
        const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        audioChunksRef.current = [];
        if (blob.size === 0) {
          setComposerError("Голосовое сообщение получилось пустым.");
          return;
        }
        const file = new File([blob], `Голосовое-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`, { type: mime });
        void uploadFiles([file], "voice");
      };
      recorder.start(250);
      setRecordingSeconds(0);
      setRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => {
          if (seconds >= 119) {
            window.setTimeout(finishRecording, 0);
            return 120;
          }
          return seconds + 1;
        });
      }, 1000);
    } catch {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setComposerError("Нет доступа к микрофону. Разрешите его в настройках браузера.");
    }
  }, [finishRecording, uploadFiles]);

  const autoresize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Cap at ~6 rows (text-sm line-height ~20px + py-2 → ~24px per row)
    const max = 24 * 6 + 16;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, []);

  const submit = useCallback(() => {
    const text = value.trim();
    if (text.toLowerCase() === "/stop") {
      setValue("");
      setComposerError(null);
      if (streaming) {
        onAbort?.();
      } else {
        setComposerError("Сейчас нет активной задачи для остановки.");
      }
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (el) el.style.height = "auto";
      });
      return;
    }
    const readyAttachments = pending
      .filter((item) => item.status === "ready" && item.attachment)
      .map((item) => item.attachment!);
    const hasBlockingUpload = pending.some((item) => item.status !== "ready");
    if (streaming) {
      setComposerError("Пока Нэйра выполняет задачу, введите /stop для остановки.");
      return;
    }
    if ((!text && readyAttachments.length === 0) || disabled || hasBlockingUpload || recording) return;
    pendingRef.current = [];
    onSend(text, readyAttachments);
    setValue("");
    setPending([]);
    setComposerError(null);
    // Reset textarea height after send
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) el.style.height = "auto";
    });
  }, [value, pending, disabled, streaming, recording, onSend, onAbort]);

  const busy = pending.some((item) => (
    item.status === "queued" || item.status === "uploading" || item.status === "transcribing"
  ));
  const pendingBytes = pending.reduce((total, item) => total + item.size, 0);
  const hasReadyAttachment = pending.some((item) => item.status === "ready");
  const canSend = (value.trim().length > 0 || hasReadyAttachment) && !busy && !recording && !disabled;
  const recordingLabel = `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`;

  return (
    // No bg- override on the composer wrap either — only border-t separates
    // the input area from the transcript. The textarea + send button retain
    // their own bg-card (it's a real container, not a background overlay).
    <div className="border-t border-border">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={CHAT_FILE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void uploadFiles(files);
          }}
        />
        {pending.length > 0 && (
          <div className="mb-2">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[0.7rem] text-muted-foreground">
              <span>{pending.length} из {CHAT_UPLOAD_MAX_FILES} файлов</span>
              <span>{formatBytes(pendingBytes)} из 500 МБ</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {pending.map((item) => (
                <div
                  key={item.localId}
                  className={cn(
                    "relative flex max-w-full items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-1.5 text-xs",
                    item.status === "error" ? "border-destructive/40 text-destructive" : "border-border bg-card",
                  )}
                >
                {item.status === "uploading" || item.status === "transcribing" ? (
                  <LoaderCircle size={14} className="shrink-0 animate-spin" aria-hidden />
                ) : item.attachment?.kind === "image" ? (
                  <ImageIcon size={14} className="shrink-0" aria-hidden />
                ) : item.attachment?.kind === "voice" || item.attachment?.kind === "audio" ? (
                  <AudioLines size={14} className="shrink-0" aria-hidden />
                ) : (
                  <FileText size={14} className="shrink-0" aria-hidden />
                )}
                <span className="max-w-48 truncate">{item.name}</span>
                <span className="opacity-60">
                  {item.status === "queued" && "в очереди"}
                  {item.status === "uploading" && `${item.progress}%`}
                  {item.status === "transcribing" && "распознавание"}
                  {item.status === "ready" && item.attachment && formatBytes(item.attachment.size)}
                  {item.status === "error" && (item.error ?? "ошибка")}
                </span>
                {item.status === "error" && item.attachment && (
                  <button
                    type="button"
                    onClick={() => void transcribePending(item.localId, item.attachment!)}
                    title="Повторить распознавание"
                    aria-label="Повторить распознавание"
                    className="rounded p-0.5 hover:bg-current/10"
                  >
                    <RotateCcw size={13} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePending(item)}
                  disabled={item.status === "queued" || item.status === "uploading" || item.status === "transcribing"}
                  title={
                    item.status === "queued" || item.status === "uploading" || item.status === "transcribing"
                      ? "Дождитесь завершения загрузки"
                      : "Убрать вложение"
                  }
                  aria-label={`Убрать вложение ${item.name}`}
                  className="rounded p-0.5 hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <X size={13} aria-hidden />
                </button>
                {item.status === "uploading" && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary transition-[width]"
                    style={{ width: `${item.progress}%` }}
                  />
                )}
                </div>
              ))}
            </div>
          </div>
        )}
        {recording && (
          <div className="mb-2 flex items-center gap-2 text-sm text-destructive font-sans normal-case tracking-normal">
            <span className="size-2 animate-pulse rounded-full bg-destructive" />
            Запись голосового {recordingLabel}
          </div>
        )}
        {composerError && (
          <p role="alert" className="mb-2 text-xs text-destructive font-sans normal-case tracking-normal">
            {composerError}
          </p>
        )}
        <div
          className={cn(
            "flex items-end gap-2 rounded-md border border-border bg-card px-2 py-1.5",
            // a11y: visible focus indicator when textarea inside is focused.
            // Restored after Codex review caught its absence. Uses midground
            // (Neyra's mid neutral) rather than primary so it doesn't scream;
            // ring-2 + offset matches the focus-visible pattern used in
            // SidebarNavLink / SidebarFooter elsewhere in the dashboard.
            "transition-[box-shadow,border-color]",
            "focus-within:ring-2 focus-within:ring-midground/50",
            "focus-within:ring-offset-0 focus-within:border-midground/60",
          )}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || busy || recording}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/30 hover:text-foreground disabled:opacity-40"
            aria-label="Приложить файл"
            title="Приложить файл"
          >
            <Paperclip size={17} aria-hidden />
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoresize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              recording
                ? "Идёт запись голосового…"
                : streaming
                  ? "Нэйра работает… Введите /stop для остановки"
                  : "Напишите сообщение…"
            }
            disabled={(disabled && !streaming) || recording}
            className={cn(
              "flex-1 resize-none bg-transparent outline-none",
              "text-sm leading-6 placeholder:text-muted-foreground/60",
              "min-h-[24px] max-h-[160px] px-2 py-1",
              "disabled:opacity-60",
              // Composer input is real prose, not UI label — opt out of UPPERCASE.
              "font-sans normal-case tracking-normal",
            )}
            aria-label="Сообщение"
          />
          {!streaming && (
            <button
              type="button"
              onClick={recording ? finishRecording : startRecording}
              disabled={disabled || busy}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40",
                recording
                  ? "bg-destructive text-white hover:bg-destructive/80"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
              )}
              aria-label={recording ? "Завершить запись" : "Записать голосовое"}
              title={recording ? "Завершить запись" : "Записать голосовое"}
            >
              {recording ? <Square size={14} aria-hidden /> : <Mic size={17} aria-hidden />}
            </button>
          )}
          {streaming ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setComposerError(null);
                onAbort?.();
              }}
              className={cn(
                "shrink-0 size-8 rounded-md",
                "bg-destructive/10 text-destructive hover:bg-destructive/20",
                "flex items-center justify-center transition-opacity",
              )}
              aria-label="Остановить"
            >
              <Square size={14} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className={cn(
                "shrink-0 size-8 rounded-md border border-border",
                "bg-primary/10 text-primary hover:bg-primary/20",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "flex items-center justify-center transition-opacity",
              )}
              aria-label="Отправить"
            >
              <Send size={14} aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[0.7rem] text-muted-foreground/60 font-sans normal-case tracking-normal">
          До 20 файлов по 100 МБ, суммарно до 500 МБ · Загружаются по 3 одновременно
          <br />Enter — отправить · Shift+Enter — новая строка · /stop — остановить задачу
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BubbleChatPage (default export)                                    */
/* ------------------------------------------------------------------ */

export default function BubbleChatPage() {
  // Live SSE state from useChatStream. Sends POST to /api/chat/completions
  // and streams response chunks back into messages[]. Tool progress events
  // update the last assistant message's toolCalls[].
  const {
    messages,
    sessionId,
    isStreaming,
    error,
    send,
    ensureSessionId,
    abort,
    loadSession,
    reset,
  } = useChatStream();

  // Live sidebar — real /api/sessions list (TG + web combined). Poll every
  // 15s so sessions started elsewhere (Telegram bot, CLI) show up here too.
  const sessionList = useSessionList({ pollIntervalMs: 15_000 });

  // Deep-link support: /chat?resume=<sessionId> auto-loads that session on
  // mount. Preserves bookmark compatibility with the legacy xterm ChatPage
  // (which also accepted ?resume=) after Phase 2.5.b takeover.
  // Codex stop-gate review #12.
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeHandledRef = useRef(false);
  useEffect(() => {
    if (resumeHandledRef.current) return;
    const resume = searchParams.get("resume");
    if (!resume || sessionId === resume) return;
    resumeHandledRef.current = true;
    void loadSession(resume);
    // Clear the query param so a navigation in/out doesn't re-trigger
    // (which would also clobber any user-initiated session switch).
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, sessionId, loadSession]);

  // After the current stream finalizes, refresh the sidebar so the new
  // session (just created server-side via X-Neyra-Session-Id) appears
  // without waiting for the next poll tick.
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      void sessionList.refresh();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, sessionList]);

  const handleSelect = useCallback(
    (id: string) => {
      void loadSession(id);
    },
    [loadSession],
  );

  const handleNewChat = useCallback(() => {
    reset();
  }, [reset]);

  // Delete chat: api.deleteSession then refresh the sidebar. If the deleted
  // thread is the one currently open, clear the bubble state too — otherwise
  // the user would be left with messages from a session that no longer
  // exists on the server.
  const sessionDelete = useConfirmDelete<string>({
    onDelete: async (id) => {
      await api.deleteSession(id);
      if (id === sessionId) reset();
      void sessionList.refresh();
    },
  });

  return (
    // Inherit parent layout background (App.tsx main wrapper). NO bg- override.
    //
    // Edge-to-edge layout:
    // - Horizontal: -mx-3 sm:-mx-6 cancels the App.tsx wrapper's px padding.
    //   Width stays stable (parent w-full doesn't depend on inner margins).
    // - Vertical: handled at the parent level — App.tsx applies `py-0` for
    //   isChatRoute so this h-full can reliably claim the full viewport
    //   height. Negative -mt/-mb here would race with h-full (Codex review #6).
    <div className="flex h-full min-h-0 -mx-3 sm:-mx-6">
      <BubbleChatSidebar
        sessions={sessionList.sessions}
        activeId={sessionId}
        loading={sessionList.loading}
        error={sessionList.error}
        onSelect={handleSelect}
        onNewChat={handleNewChat}
        onRequestDelete={sessionDelete.requestDelete}
      />
      <DeleteConfirmDialog
        open={sessionDelete.isOpen}
        onCancel={sessionDelete.cancel}
        onConfirm={sessionDelete.confirm}
        loading={sessionDelete.isDeleting}
        title="Удалить чат?"
        // Honest scope: api.deleteSession removes the session + messages
        // rows from state.db, but raw transcript files on disk
        // (.json/.jsonl/request_dump_*) are NOT touched by the server-side
        // endpoint (delete_session_endpoint в web_server.py не передаёт
        // sessions_dir в SessionDB.delete_session). Codex stop-gate #14
        // caught the previous "удалены безвозвратно" wording as misleading.
        description="Чат, сообщения и загруженные в него файлы будут удалены."
      />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <BubbleChatTranscript
          messages={messages}
          streaming={isStreaming}
          error={error}
        />
        <BubbleChatComposer
          key={sessionId ?? "new-chat"}
          onSend={send}
          ensureSessionId={ensureSessionId}
          streaming={isStreaming}
          onAbort={abort}
          // UI guard: disable Enter-key submits during streaming. The
          // composer also swaps the Send button for Stop, but a stray
          // Enter would still call submit() and bypass the swap. Pair
          // with the ref-guard in useChatStream.send (Codex review #7).
          disabled={isStreaming}
        />
      </main>
    </div>
  );
}
