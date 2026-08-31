declare global {
  interface Window {
    /** Set true by the server only for `neyra dashboard --tui` (or NEYRA_DASHBOARD_TUI=1). */
    __NEYRA_DASHBOARD_EMBEDDED_CHAT__?: boolean;
    /** @deprecated Older injected name; treated as on when true. */
    __NEYRA_DASHBOARD_TUI__?: boolean;
    /** Set true by the server when NEYRA_DASHBOARD_CHAT=1 — Neyra bubble SSE chat takeover of /chat. */
    __NEYRA_DASHBOARD_CHAT__?: boolean;
  }
}

/** True only when the dashboard was started with embedded TUI Chat (`neyra dashboard --tui`). */
export function isDashboardEmbeddedChatEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__NEYRA_DASHBOARD_EMBEDDED_CHAT__ === true) return true;
  return window.__NEYRA_DASHBOARD_TUI__ === true;
}

/** True when the dashboard should take over /chat with the Neyra bubble SSE chat (NEYRA_DASHBOARD_CHAT=1). */
export function isDashboardBubbleChatEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.__NEYRA_DASHBOARD_CHAT__ === true;
}
