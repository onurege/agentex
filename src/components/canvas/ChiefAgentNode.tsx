"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AgentDefinition, AgentRuntime, OrchestrationPhase } from "@/lib/types";

interface ChiefAgentNodeData {
  agent: AgentDefinition;
  runtime?: AgentRuntime;
  phase?: OrchestrationPhase;
  [key: string]: unknown;
}

// Pixel art karakter ASCII temsilleri
const CHIEF_PIXEL = [
  "  ▄███▄  ",
  " █▓▓▓▓▓█ ",
  "█▓▓▓▓▓▓▓█",
  " ███████ ",
  "  █▓█▓█  ",
];

const STATE_LABELS: Record<string, string> = {
  idle: "BEKLİYOR",
  waiting: "SIRA BEKL.",
  reading: "OKUYOR...",
  analyzing: "ANALİZ ED.",
  debating: "TARTIŞIYOR",
  "proposing-edit": "ÖNERİ HAZIRL.",
  synthesizing: "SENTEZLİYOR",
  done: "TAMAMLANDI",
};

const STATE_BUBBLE: Record<string, string> = {
  idle: "Hazır olduğunuzda başlayabiliriz...",
  waiting: "Ekip için sabırla bekliyorum...",
  reading: "Sözleşmeyi inceliyorum...",
  analyzing: "Risk analizi yapılıyor...",
  debating: "Ekiple tartışıyorum...",
  "proposing-edit": "Revizyonlar hazırlanıyor...",
  synthesizing: "Tüm bulguları özetliyorum...",
  done: "Raporunuz hazır! 📋",
};

function ChiefAgentNodeInner({ data }: NodeProps) {
  const { agent, runtime, phase } = data as unknown as ChiefAgentNodeData;
  const state = runtime?.state || "idle";

  const isActive = phase !== "idle" && phase !== "complete";
  const isDone = state === "done";

  const borderColor = isActive
    ? "border-accent-primary"
    : isDone
    ? "border-accent-success"
    : "border-workspace-border";

  const glowClass = isActive
    ? "shadow-[0_0_20px_rgba(232,160,48,0.25),4px_4px_0px_rgba(0,0,0,0.5)]"
    : "shadow-[4px_4px_0px_rgba(0,0,0,0.5)]";

  return (
    <div className={`relative w-[200px] transition-all duration-500`}>
      {/* Konuşma balonu */}
      {state !== "idle" && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[180px] z-10">
          <div className="relative bg-workspace-paper text-workspace-bg text-2xs font-mono px-2 py-1.5 rounded-sm leading-relaxed text-center"
               style={{ boxShadow: '1px 1px 0px rgba(0,0,0,0.4)' }}>
            {STATE_BUBBLE[state] ?? state}
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0"
                 style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #F5EDD8' }} />
          </div>
        </div>
      )}

      {/* Ana kart — masa üstü dosya kutusu gibi */}
      <div
        className={`
          w-full border-2 ${borderColor} ${glowClass}
          bg-workspace-elevated transition-all duration-500 relative overflow-hidden
        `}
      >
        {/* Canlı gösterge — led */}
        {isActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-accent-primary animate-pulse" />
            <div className="w-1 h-2 bg-accent-primary/50 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-1 h-2 bg-accent-primary/30 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
        {isDone && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-accent-success" />
        )}

        {/* Başlık şeridi */}
        <div className="bg-accent-primary/20 border-b-2 border-accent-primary/30 px-3 py-1 flex items-center gap-1.5">
          <span className="text-2xs font-mono text-accent-primary/70 uppercase tracking-widest">
            ★ ŞEF AJAN
          </span>
        </div>

        {/* Pixel avatar */}
        <div className="flex flex-col items-center pt-4 pb-2 px-3">
          <div
            className={`
              w-16 h-16 flex items-center justify-center text-3xl mb-2
              bg-workspace-surface border-2 ${isDone ? 'border-accent-success/50' : isActive ? 'border-accent-primary/50' : 'border-workspace-border'}
              relative
            `}
            style={{ imageRendering: 'pixelated' }}
          >
            {/* Pixel karakteri */}
            <div className="font-pixel text-center" style={{ fontSize: '1.6rem', lineHeight: 1 }}>
              {agent.avatar}
            </div>
            {/* Köşe dekorasyonları — pixel sanat köşeleri */}
            <div className="absolute top-0 left-0 w-2 h-2 bg-accent-primary/30" />
            <div className="absolute top-0 right-0 w-2 h-2 bg-accent-primary/30" />
            <div className="absolute bottom-0 left-0 w-2 h-2 bg-accent-primary/30" />
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-accent-primary/30" />
          </div>

          {/* İsim */}
          <h3 className="text-xs font-semibold text-text-primary font-mono text-center">
            {agent.name}
          </h3>
          <p className="text-2xs text-text-muted font-mono mt-0.5 text-center leading-relaxed">
            {agent.title}
          </p>

          {/* Durum rozeti */}
          <div className="mt-2.5 w-full">
            <div
              className={`
                flex items-center justify-center gap-1.5 py-1 text-2xs font-mono
                ${isActive
                  ? "bg-accent-primary/15 border border-accent-primary/30 text-accent-primary"
                  : isDone
                  ? "bg-accent-success/15 border border-accent-success/30 text-accent-success"
                  : "bg-workspace-surface border border-workspace-border text-text-muted"
                }
              `}
            >
              <span className={`agent-state-dot agent-state-${state}`} />
              {STATE_LABELS[state] ?? state}
            </div>
          </div>
        </div>

        {/* Alt HP bar — analiz ilerlemesi gibi */}
        {isActive && (
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs font-mono text-text-muted">İLERLEME</span>
              <span className="text-2xs font-mono text-accent-primary">▓▓▓░░</span>
            </div>
            <div className="h-1.5 bg-workspace-surface border border-workspace-border overflow-hidden">
              <div className="h-full bg-accent-primary animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Bağlantı noktaları */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-accent-primary/50 !border-2 !border-accent-primary !rounded-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-accent-primary/50 !border-2 !border-accent-primary !rounded-none"
      />
    </div>
  );
}

export const ChiefAgentNode = memo(ChiefAgentNodeInner);
