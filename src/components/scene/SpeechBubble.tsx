"use client";

import { useEffect, useState } from "react";
import { SceneBubble, BubbleVariant } from "@/lib/scene-types";

interface SpeechBubbleProps {
  bubble: SceneBubble;
  agentName: string;
  side: "left" | "right" | "center";
}

const VARIANT_STYLES: Record<
  BubbleVariant,
  { container: string; label?: string; labelColor: string }
> = {
  normal: {
    container:
      "bg-workspace-elevated/95 border-workspace-border text-text-primary",
    labelColor: "text-text-muted",
  },
  disagreement: {
    container:
      "bg-accent-warning/8 border-accent-warning/35 text-text-primary",
    label: "ÇATIŞMA",
    labelColor: "text-accent-warning",
  },
  synthesis: {
    container:
      "bg-accent-primary/8 border-accent-primary/35 text-text-primary",
    label: "SENTEZ",
    labelColor: "text-accent-primary",
  },
  complete: {
    container:
      "bg-accent-success/8 border-accent-success/30 text-text-primary",
    label: "TAMAMLANDI",
    labelColor: "text-accent-success",
  },
};

export function SpeechBubble({ bubble, agentName, side }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const styles = VARIANT_STYLES[bubble.variant];

  return (
    <div
      className={`
        relative border rounded-lg px-3 py-2
        transition-all duration-200
        ${styles.container}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
      style={{
        boxShadow:
          bubble.variant === "synthesis"
            ? "0 0 16px rgba(59,130,246,0.12), 0 4px 12px rgba(0,0,0,0.3)"
            : bubble.variant === "disagreement"
            ? "0 0 12px rgba(245,158,11,0.1), 0 4px 12px rgba(0,0,0,0.3)"
            : "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-2xs font-mono font-semibold ${styles.labelColor}`}
        >
          {agentName}
        </span>
        {styles.label && (
          <span
            className={`text-2xs font-mono px-1.5 py-px rounded border ${
              bubble.variant === "disagreement"
                ? "border-accent-warning/30 text-accent-warning"
                : bubble.variant === "synthesis"
                ? "border-accent-primary/30 text-accent-primary"
                : "border-accent-success/30 text-accent-success"
            }`}
          >
            {styles.label}
          </span>
        )}
      </div>

      {/* Message */}
      <p className="text-xs font-mono text-text-secondary leading-relaxed">
        {bubble.text}
      </p>

      {/* Tail indicator */}
      <div
        className="absolute w-2 h-2 -bottom-[5px] rotate-45 border-b border-r"
        style={{
          left:
            side === "center" ? "50%" : side === "left" ? "24px" : undefined,
          right: side === "right" ? "24px" : undefined,
          transform: "translateX(-50%) rotate(45deg)",
          backgroundColor:
            bubble.variant === "disagreement"
              ? "rgba(245,158,11,0.08)"
              : bubble.variant === "synthesis"
              ? "rgba(59,130,246,0.08)"
              : bubble.variant === "complete"
              ? "rgba(16,185,129,0.08)"
              : "rgba(28,32,41,0.95)",
          borderColor:
            bubble.variant === "disagreement"
              ? "rgba(245,158,11,0.35)"
              : bubble.variant === "synthesis"
              ? "rgba(59,130,246,0.35)"
              : bubble.variant === "complete"
              ? "rgba(16,185,129,0.30)"
              : "rgba(42,47,58,1)",
        }}
      />
    </div>
  );
}
