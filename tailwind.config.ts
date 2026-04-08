import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern dark-neutral workspace
        workspace: {
          bg: "#0F1117",
          surface: "#161A22",
          elevated: "#1C2029",
          border: "#2A2F3A",
          "border-subtle": "#22262F",
          paper: "#E2E8F0",
          "paper-dim": "#CBD5E1",
        },
        accent: {
          primary: "#3B82F6",
          secondary: "#2563EB",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          info: "#06B6D4",
        },
        text: {
          primary: "#E2E8F0",
          secondary: "#94A3B8",
          tertiary: "#64748B",
          muted: "#475569",
        },
        // Agent role identity
        agent: {
          chief: "#3B82F6",
          legal: "#6366F1",
          finance: "#10B981",
          tax: "#F59E0B",
          sales: "#EF4444",
          product: "#8B5CF6",
        },
        // Legacy compat tokens
        pixel: {
          amber: "#F59E0B",
          green: "#10B981",
          blue: "#3B82F6",
          red: "#EF4444",
          purple: "#8B5CF6",
          orange: "#F97316",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
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
        soft: "0 2px 8px rgba(0,0,0,0.3)",
        medium: "0 4px 16px rgba(0,0,0,0.4)",
        "glow-blue": "0 0 20px rgba(59,130,246,0.15)",
        "glow-success": "0 0 16px rgba(16,185,129,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
