"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { formatTimestamp } from "@/lib/utils";

const PHASE_LABELS: Record<string, string> = {
  briefing: "📋 BRİFİNG",
  "parallel-review": "🔄 PARALEL İNCELEME",
  debate: "💬 PANEL TARTIŞMASI",
  "synthesis": "🧩 SENTEZ",
  complete: "✅ TAMAMLANDI",
};

export function ActivityStream() {
  const activityStream = useWorkspaceStore((s) => s.job.activityStream);
  const orchestrationPhase = useWorkspaceStore((s) => s.job.orchestrationPhase);
  const status = useWorkspaceStore((s) => s.job.status);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityStream.length]);

  if (status === "setup" || (status === "ready" && activityStream.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
        <div
          className="w-12 h-12 bg-workspace-elevated border border-workspace-border rounded-lg flex items-center justify-center mb-3 shadow-soft"
        >
          <span className="text-xl">📡</span>
        </div>
        <p className="text-xs font-mono text-text-secondary">CANLI AKTİVİTE</p>
        <p className="text-2xs font-mono text-text-muted mt-1.5 leading-relaxed">
          Ajan aktivitesi analiz sırasında<br />burada görünecek
        </p>
        {/* Bekleme animasyonu */}
        <div className="flex gap-1 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 bg-workspace-border animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="p-2.5 space-y-1.5">
      {/* Faz göstergesi */}
      {orchestrationPhase !== "idle" && (
        <div
          className={`
            flex items-center gap-2 px-2.5 py-1.5 mb-2 border font-mono text-2xs
            ${orchestrationPhase === "complete"
              ? "bg-accent-success/8 border-accent-success/30 text-accent-success"
              : "bg-accent-primary/8 border-accent-primary/30 text-accent-primary"
            }
          `}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
        >
          {orchestrationPhase !== "complete" && (
            <div className="w-1.5 h-1.5 bg-accent-primary animate-pulse flex-shrink-0" />
          )}
          <span className="uppercase tracking-wider">
            {PHASE_LABELS[orchestrationPhase] ?? orchestrationPhase}
          </span>
        </div>
      )}

      {/* Olaylar */}
      {activityStream.map((event) => {
        const agent = AGENTS[event.agentId];
        const isDisagreement = event.type === "disagreement";
        const isSynthesis = event.type === "synthesis";
        const isComplete = event.type === "complete";

        return (
          <div
            key={event.id}
            className={`
              flex items-start gap-2 p-2 animate-fade-in border
              ${isDisagreement
                ? "bg-accent-warning/5 border-accent-warning/20"
                : isSynthesis
                ? "bg-accent-primary/5 border-accent-primary/20"
                : isComplete
                ? "bg-accent-success/5 border-accent-success/20"
                : "bg-workspace-elevated border-workspace-border"
              }
            `}
          >
            {/* Avatar */}
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-2xs font-mono font-bold bg-workspace-surface border border-workspace-border mt-0.5 text-text-muted">
              {agent?.avatar || "?"}
            </div>

            {/* Mesaj */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-2xs font-mono font-semibold text-text-secondary">
                  {agent?.shortName ?? "SYS"}
                </span>
                {isDisagreement && (
                  <span className="text-2xs font-mono bg-accent-warning/15 border border-accent-warning/30 text-accent-warning px-1">
                    ANLAŞMAZLIK
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-text-primary leading-relaxed">
                {event.message}
              </p>
              {event.detail && (
                <p className="text-2xs font-mono text-text-tertiary mt-0.5 leading-relaxed">
                  {event.detail}
                </p>
              )}
            </div>

            {/* Zaman */}
            <span className="text-2xs font-mono text-text-muted flex-shrink-0">
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
