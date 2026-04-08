"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AgentDefinition, AgentRuntime } from "@/lib/types";

interface ExpertAgentNodeData {
  agent: AgentDefinition;
  runtime?: AgentRuntime;
  isSelected?: boolean;
  [key: string]: unknown;
}

const STATE_LABELS: Record<string, string> = {
  idle: "BEKLİYOR",
  waiting: "SIRA BEKL.",
  reading: "OKUYOR",
  analyzing: "ANALİZ",
  debating: "TARTIŞIYOR",
  "proposing-edit": "ÖNERİYOR",
  synthesizing: "SENTEZLİYOR",
  done: "TAMAM ✓",
};

// Kısa ofis yorumları — durum başına
const STATE_QUIP: Record<string, string> = {
  idle: "☕ kahve molası",
  waiting: "⏳ sıra bende...",
  reading: "👓 okuyorum...",
  analyzing: "🔍 analiz...",
  debating: "💬 tartışıyoruz!",
  "proposing-edit": "✏️ yazıyorum...",
  synthesizing: "🧩 birleştiriyorum",
  done: "📌 bitti!",
};

// Ajan rengini role göre belirle
const ROLE_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  legal:   { border: "border-agent-legal",   bg: "bg-agent-legal/10",   text: "text-agent-legal",   glow: "rgba(58,126,192,0.3)" },
  finance: { border: "border-agent-finance", bg: "bg-agent-finance/10", text: "text-agent-finance", glow: "rgba(74,158,106,0.3)" },
  tax:     { border: "border-agent-tax",     bg: "bg-agent-tax/10",     text: "text-agent-tax",     glow: "rgba(196,122,32,0.3)" },
  sales:   { border: "border-agent-sales",   bg: "bg-agent-sales/10",   text: "text-agent-sales",   glow: "rgba(184,64,64,0.3)" },
  product: { border: "border-agent-product", bg: "bg-agent-product/10", text: "text-agent-product", glow: "rgba(122,92,184,0.3)" },
};

function ExpertAgentNodeInner({ data }: NodeProps) {
  const { agent, runtime } = data as unknown as ExpertAgentNodeData;
  const state = runtime?.state || "idle";

  const roleColor = ROLE_COLORS[agent.role] ?? ROLE_COLORS["legal"];
  const isActive = state !== "idle" && state !== "done";
  const isDone = state === "done";
  const isDebating = state === "debating";

  const shadowStyle = isActive
    ? { boxShadow: `4px 4px 0px rgba(0,0,0,0.5), 0 0 16px ${roleColor.glow}` }
    : { boxShadow: '3px 3px 0px rgba(0,0,0,0.4)' };

  return (
    <div className="relative w-[160px]" style={{ transition: 'all 0.4s' }}>
      {/* Kısa yorum balonu — aktif veya tartışmada */}
      {(isActive || isDone) && (
        <div className="absolute -top-9 left-0 right-0 z-10">
          <div
            className="relative text-2xs font-mono px-2 py-1 text-center leading-relaxed"
            style={{
              background: '#F5EDD8',
              color: '#1A1209',
              boxShadow: '1px 1px 0px rgba(0,0,0,0.3)',
              fontSize: '0.5rem',
            }}
          >
            {STATE_QUIP[state]}
            <div
              className="absolute bottom-[-5px] left-4"
              style={{
                width: 0, height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '5px solid #F5EDD8',
              }}
            />
          </div>
        </div>
      )}

      {/* Ana kart */}
      <div
        className={`
          w-full border-2 ${roleColor.border} bg-workspace-elevated
          transition-all duration-400 relative overflow-hidden
          ${isDebating ? 'animate-[wiggle_0.5s_ease-in-out_3]' : ''}
        `}
        style={shadowStyle}
      >
        {/* Durum LED'i */}
        {isActive && (
          <div className="absolute top-1.5 right-1.5 flex gap-0.5">
            <div className={`w-1.5 h-1.5 agent-state-dot agent-state-${state}`} />
          </div>
        )}
        {isDone && (
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-success" />
        )}

        {/* Üst renk şeridi */}
        <div className={`h-1 ${roleColor.bg} border-b ${roleColor.border} opacity-60`} />

        {/* İçerik */}
        <div className="px-3 py-2.5 flex flex-col items-center text-center">
          {/* Avatar — pixel çerçeve */}
          <div
            className={`
              w-10 h-10 flex items-center justify-center text-xl mb-2
              ${roleColor.bg} border ${roleColor.border}
              relative
            `}
            style={{ imageRendering: 'pixelated' }}
          >
            {agent.avatar}
            {/* köşe pikseller */}
            <div className={`absolute top-0 left-0 w-1 h-1 ${roleColor.bg}`} />
            <div className={`absolute bottom-0 right-0 w-1 h-1 ${roleColor.bg}`} />
          </div>

          {/* İsim */}
          <h3 className="text-xs font-semibold text-text-primary font-mono leading-tight">
            {agent.shortName}
          </h3>
          <p className="text-2xs text-text-muted mt-0.5 font-mono leading-snug text-center">
            {agent.title.split(" ").slice(0, 2).join(" ")}
          </p>

          {/* Durum rozeti */}
          {state !== "idle" && (
            <div className="mt-2 w-full">
              <div
                className={`
                  py-0.5 text-center text-2xs font-mono
                  ${isDone
                    ? `bg-accent-success/15 border border-accent-success/30 text-accent-success`
                    : isDebating
                    ? `bg-accent-warning/15 border border-accent-warning/30 text-accent-warning`
                    : `${roleColor.bg} border ${roleColor.border} ${roleColor.text}`
                  }
                `}
              >
                {STATE_LABELS[state] ?? state}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bağlantı noktası */}
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-2.5 !h-2.5 !border-2 !rounded-none ${roleColor.border.replace('border-', '!border-')} !bg-workspace-surface`}
      />
    </div>
  );
}

export const ExpertAgentNode = memo(ExpertAgentNodeInner);
