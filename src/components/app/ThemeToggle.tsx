"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Render a size-matched placeholder pre-hydration so layout
  // doesn't jump when the icon resolves.
  if (!mounted) {
    return (
      <div
        className={`w-8 h-8 rounded-lg border border-workspace-border bg-workspace-surface ${className}`}
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={isDark ? "Açık tema" : "Koyu tema"}
      className={`w-8 h-8 rounded-lg border border-workspace-border bg-workspace-surface hover:bg-workspace-elevated text-text-secondary hover:text-accent-primary transition-colors flex items-center justify-center ${className}`}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
