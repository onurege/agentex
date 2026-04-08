"use client";

import { AgentDefinition, AgentState } from "@/lib/types";
import { BubbleVariant } from "@/lib/scene-types";

interface AgentSeatProps {
  agent: AgentDefinition;
  runtime?: { state: AgentState; progress: number };
  isChief?: boolean;
  hasActiveBubble?: boolean;
  bubbleVariant?: BubbleVariant;
}

const STATE_LABEL: Partial<Record<AgentState, string>> = {
  idle: "Beklemede",
  waiting: "Hazırlanıyor",
  reading: "Okuyor",
  analyzing: "Analiz ediyor",
  debating: "Tartışıyor",
  "proposing-edit": "Düzenliyor",
  synthesizing: "Sentezliyor",
  done: "Tamamlandı",
};

const ROLE_BORDER: Record<string, string> = {
  chief: "border-agent-chief/40",
  legal: "border-agent-legal/40",
  finance: "border-agent-finance/40",
  tax: "border-agent-tax/40",
  sales: "border-agent-sales/40",
  product: "border-agent-product/40",
};

const ROLE_BG: Record<string, string> = {
  chief: "bg-agent-chief/10",
  legal: "bg-agent-legal/10",
  finance: "bg-agent-finance/10",
  tax: "bg-agent-tax/10",
  sales: "bg-agent-sales/10",
  product: "bg-agent-product/10",
};

const ROLE_TEXT: Record<string, string> = {
  chief: "text-agent-chief",
  legal: "text-agent-legal",
  finance: "text-agent-finance",
  tax: "text-agent-tax",
  sales: "text-agent-sales",
  product: "text-agent-product",
};

const ROLE_RAW: Record<string, string> = {
  chief: "#3B82F6",
  legal: "#6366F1",
  finance: "#10B981",
  tax: "#F59E0B",
  sales: "#EF4444",
  product: "#8B5CF6",
};

const STATE_GLOW: Partial<Record<AgentState, string>> = {
  analyzing: "shadow-[0_0_16px_rgba(59,130,246,0.25)]",
  debating: "shadow-[0_0_16px_rgba(245,158,11,0.3)]",
  synthesizing: "shadow-[0_0_20px_rgba(59,130,246,0.35)]",
};

export function AgentSeat({
  agent,
  runtime,
  isChief,
}: AgentSeatProps) {
  const state = runtime?.state ?? "idle";
  const isActive = state !== "idle" && state !== "done";
  const isDone = state === "done";
  const isDebating = state === "debating";
  const isSynthesizing = state === "synthesizing";

  const border = ROLE_BORDER[agent.role] ?? "border-workspace-border";
  const bg = ROLE_BG[agent.role] ?? "bg-workspace-elevated";
  const text = ROLE_TEXT[agent.role] ?? "text-text-secondary";
  const raw = ROLE_RAW[agent.role] ?? "#64748B";
  const glow = STATE_GLOW[state] ?? "";

  const avatarSize = isChief ? "w-[72px] h-[72px]" : "w-14 h-14";
  const initialsSize = isChief ? "text-xl" : "text-base";
  const nameClass = isChief ? "text-sm" : "text-xs";
  const containerW = isChief ? "w-[140px]" : "w-[100px]";

  const activeBorder = isDebating ? "border-accent-warning/50" : border;
  const activeGlow = isDebating
    ? "shadow-[0_0_18px_rgba(245,158,11,0.35)]"
    : isSynthesizing
    ? "shadow-[0_0_24px_rgba(59,130,246,0.4)]"
    : glow;

  return (
    <div className={`flex flex-col items-center gap-2 ${containerW}`}>
      {/* Avatar */}
      <div className="relative">
        <div
          className={`
            ${avatarSize} rounded-full flex items-center justify-center relative overflow-hidden
            ${bg} border-2 ${activeBorder}
            ${activeGlow}
            ${isActive ? "seat-active-pulse" : ""}
            transition-all duration-300
          `}
        >
          {/* Human silhouette background */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 56 56"
            fill="none"
          >
            <circle cx="28" cy="18" r="7" fill={raw} opacity="0.12" />
            <ellipse cx="28" cy="42" rx="14" ry="10" fill={raw} opacity="0.08" />
          </svg>

          {/* Initials */}
          <span
            className={`relative ${initialsSize} font-bold ${text} select-none`}
          >
            {agent.avatar}
          </span>

          {/* Active shimmer */}
          {(isDebating || isSynthesizing) && (
            <div
              className="absolute inset-0 pointer-events-none animate-pulse rounded-full"
              style={{
                background: isDebating
                  ? "rgba(245,158,11,0.06)"
                  : "rgba(59,130,246,0.08)",
              }}
            />
          )}
        </div>

        {/* State indicator dot */}
        {(isActive || isDone) && (
          <span
            className={`
              absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-workspace-bg
              ${isDone ? "bg-accent-success" : ""}
              ${isDebating ? "bg-accent-warning animate-pulse" : ""}
              ${isSynthesizing ? "bg-accent-primary animate-pulse" : ""}
              ${state === "analyzing" ? "bg-accent-primary animate-pulse" : ""}
              ${state === "reading" ? "bg-accent-info animate-pulse" : ""}
              ${state === "waiting" ? "bg-text-muted animate-pulse" : ""}
            `}
          />
        )}
      </div>

      {/* Name & title */}
      <div className="text-center">
        <p
          className={`font-mono font-semibold ${nameClass} ${text} leading-tight`}
        >
          {agent.shortName}
        </p>
        {isChief && (
          <p className="text-2xs font-mono text-text-muted leading-tight mt-0.5">
            {agent.title}
          </p>
        )}
      </div>

      {/* State badge */}
      {(isActive || isDone) && (
        <div
          className={`
            px-2 py-0.5 rounded text-2xs font-mono text-center leading-none
            ${
              isDone
                ? "bg-accent-success/10 text-accent-success border border-accent-success/20"
                : isDebating
                ? "bg-accent-warning/10 text-accent-warning border border-accent-warning/20"
                : `${bg} ${text} border ${border}`
            }
          `}
        >
          {STATE_LABEL[state] ?? state}
        </div>
      )}
    </div>
  );
}
