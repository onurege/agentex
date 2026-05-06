import type { Config } from "tailwindcss";

// ============================================================
// AGENTEX — Tailwind Tokens (Param Brand Concept palette)
// ------------------------------------------------------------
// All color tokens are CSS-variable-backed so every class
// (bg-workspace-surface, text-text-primary, …) automatically
// honors :root (light) vs .dark. See src/app/globals.css for
// the values.
// ============================================================

const rgbVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        workspace: {
          bg: rgbVar("--color-workspace-bg"),
          surface: rgbVar("--color-workspace-surface"),
          elevated: rgbVar("--color-workspace-elevated"),
          border: rgbVar("--color-workspace-border"),
          "border-subtle": rgbVar("--color-workspace-border-subtle"),
          paper: rgbVar("--color-workspace-paper"),
          "paper-dim": rgbVar("--color-workspace-paper-dim"),
        },
        accent: {
          primary: rgbVar("--color-accent-primary"),
          secondary: rgbVar("--color-accent-secondary"),
          success: rgbVar("--color-accent-success"),
          warning: rgbVar("--color-accent-warning"),
          danger: rgbVar("--color-accent-danger"),
          info: rgbVar("--color-accent-info"),
        },
        semantic: {
          positive: rgbVar("--color-semantic-positive"),
          negative: rgbVar("--color-semantic-negative"),
        },
        text: {
          primary: rgbVar("--color-text-primary"),
          secondary: rgbVar("--color-text-secondary"),
          tertiary: rgbVar("--color-text-tertiary"),
          muted: rgbVar("--color-text-muted"),
        },
        agent: {
          chief: rgbVar("--color-agent-chief"),
          legal: rgbVar("--color-agent-legal"),
          finance: rgbVar("--color-agent-finance"),
          tax: rgbVar("--color-agent-tax"),
          sales: rgbVar("--color-agent-sales"),
          product: rgbVar("--color-agent-product"),
          research: rgbVar("--color-agent-research"),
        },
        pixel: {
          amber: rgbVar("--color-pixel-amber"),
          green: rgbVar("--color-pixel-green"),
          blue: rgbVar("--color-pixel-blue"),
          red: rgbVar("--color-pixel-red"),
          purple: rgbVar("--color-pixel-purple"),
          orange: rgbVar("--color-pixel-orange"),
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in-left": "slideInLeft 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        medium: "var(--shadow-medium)",
        "glow-blue": "var(--shadow-glow-blue)",
        "glow-success": "var(--shadow-glow-success)",
      },
    },
  },
  plugins: [],
};

export default config;
