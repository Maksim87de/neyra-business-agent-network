import type { DashboardTheme, ThemeTypography, ThemeLayout } from "./types";

/**
 * Built-in dashboard color modes.
 *
 * The product shell intentionally exposes only the Neyra dark interface and a
 * plain light counterpart.  The names must stay in sync with
 * `_BUILTIN_DASHBOARD_THEMES` in `neyra_cli/web_server.py`.
 */

const GOOGLE_SANS = '"Google Sans", sans-serif';

const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontSans: GOOGLE_SANS,
  fontMono: GOOGLE_SANS,
  baseSize: "15px",
  lineHeight: "1.55",
  letterSpacing: "0",
};

const DEFAULT_LAYOUT: ThemeLayout = {
  radius: "0.875rem",
  density: "comfortable",
};

export const defaultTheme: DashboardTheme = {
  name: "default",
  label: "Dark",
  description: "Neyra dark blue interface",
  palette: {
    background: { hex: "#08111e", alpha: 1 },
    midground: { hex: "#cde9f0", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(77, 208, 225, 0.20)",
    noiseOpacity: 0.32,
  },
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  colorOverrides: {
    primary: "#4dd0e1",
    primaryForeground: "#08111e",
    secondary: "#5468ff",
    secondaryForeground: "#f3f5ff",
    accent: "#7df9ff",
    ring: "#4dd0e1",
    success: "#4dd0e1",
  },
  componentStyles: {
    sidebar: {
      background:
        "linear-gradient(180deg, rgba(20, 38, 64, 0.62) 0%, rgba(10, 20, 40, 0.78) 100%)",
      "backdrop-filter": "blur(28px) saturate(160%)",
      "-webkit-backdrop-filter": "blur(28px) saturate(160%)",
    },
  },
  customCSS: `
    [data-slot="card"],
    [data-slot="popover-content"],
    [data-slot="dialog-content"],
    [data-slot="dropdown-menu-content"],
    [data-slot="select-content"],
    .glass-surface {
      background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015)) !important;
      backdrop-filter: blur(24px) saturate(170%) !important;
      -webkit-backdrop-filter: blur(24px) saturate(170%) !important;
      border: 1px solid rgba(180, 220, 255, 0.12) !important;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.06) inset,
        0 12px 40px rgba(8, 17, 30, 0.45) !important;
    }
    [data-slot="tabs-list"] {
      background: rgba(255,255,255,0.04) !important;
      backdrop-filter: blur(12px) saturate(150%) !important;
      -webkit-backdrop-filter: blur(12px) saturate(150%) !important;
      border: 1px solid rgba(180, 220, 255, 0.08) !important;
    }
    [data-slot="button"][data-variant="default"]:not([data-ghost]) {
      box-shadow:
        0 1px 0 rgba(255,255,255,0.18) inset,
        0 4px 16px rgba(77, 208, 225, 0.22);
    }
  `,
};

export const lightTheme: DashboardTheme = {
  name: "light",
  label: "Light",
  description: "Neyra light interface",
  palette: {
    background: { hex: "#f5f8fb", alpha: 1 },
    midground: { hex: "#1f2a37", alpha: 1 },
    foreground: { hex: "#1f2a37", alpha: 0 },
    warmGlow: "rgba(96, 165, 250, 0.08)",
    noiseOpacity: 0.035,
  },
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  colorOverrides: {
    card: "rgba(255, 255, 255, 0.78)",
    cardForeground: "#1f2a37",
    popover: "#ffffff",
    popoverForeground: "#1f2a37",
    primary: "#256f8f",
    primaryForeground: "#ffffff",
    secondary: "#e7eef5",
    secondaryForeground: "#1f2a37",
    muted: "#edf3f7",
    mutedForeground: "#647386",
    accent: "#dcecf6",
    accentForeground: "#1f2a37",
    border: "rgba(31, 42, 55, 0.12)",
    input: "rgba(31, 42, 55, 0.16)",
    ring: "#256f8f",
  },
  componentStyles: {
    sidebar: {
      background:
        "linear-gradient(180deg, rgba(248, 252, 255, 0.86) 0%, rgba(231, 239, 246, 0.92) 100%)",
      "backdrop-filter": "blur(24px) saturate(150%)",
      "-webkit-backdrop-filter": "blur(24px) saturate(150%)",
    },
  },
  customCSS: `
    [data-slot="card"],
    [data-slot="popover-content"],
    [data-slot="dialog-content"],
    [data-slot="dropdown-menu-content"],
    [data-slot="select-content"],
    .glass-surface {
      background: rgba(255,255,255,0.78) !important;
      backdrop-filter: blur(18px) saturate(150%) !important;
      -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
      border: 1px solid rgba(31, 42, 55, 0.11) !important;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.9) inset,
        0 12px 32px rgba(31, 42, 55, 0.08) !important;
    }
    [data-slot="tabs-list"] {
      background: rgba(31, 42, 55, 0.035) !important;
      border: 1px solid rgba(31, 42, 55, 0.09) !important;
    }
  `,
};

export const BUILTIN_THEMES: Record<string, DashboardTheme> = {
  default: defaultTheme,
  light: lightTheme,
};
