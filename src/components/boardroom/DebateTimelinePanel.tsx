"use client";

import { useRef, useEffect } from "react";
import type { DebateEvent } from "@/lib/boardroom-flow-store";

interface DebateTimelinePanelProps {
  events: DebateEvent[];
}

const TYPE_LABELS: Record<DebateEvent["type"], { label: string; style: string }> = {
  arrival: { label: "Varış", style: "text-text-muted" },
  observation: { label: "Gözlem", style: "text-accent-info" },
  analysis: { label: "Analiz", style: "text-accent-primary" },
  objection: { label: "İtiraz", style: "text-accent-warning" },
  disagreement: { label: "Görüş Ayrılığı", style: "text-accent-danger" },
  defense: { label: "Savunma", style: "text-accent-info" },
  "rebuttal-defend": { label: "Savunma Yanıtı", style: "text-accent-info" },
  "rebuttal-challenge": { label: "Karşı Yanıt", style: "text-accent-warning" },
  "rebuttal-concede": { label: "Kısmi Kabul", style: "text-accent-success" },
  "rebuttal-refine": { label: "Pozisyon Güncelleme", style: "text-accent-primary" },
  synthesis: { label: "Sentez", style: "text-accent-primary" },
  verdict: { label: "Karar", style: "text-accent-success" },
};

export function DebateTimelinePanel({ events }: DebateTimelinePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <aside className="w-[340px] shrink-0 border-l border-workspace-border bg-workspace-surface/50 flex flex-col">
      <div className="px-5 py-4 border-b border-workspace-border/30">
        <h2 className="text-lg font-semibold text-text-primary">
          Canlı Tartışma Akışı
        </h2>
        <p className="text-[13px] text-text-muted mt-0.5">
          {events.length} olay
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {events.length === 0 && (
          <p className="text-base text-text-muted text-center py-8">
            Tartışma başladığında konuşmalar burada görünecek.
          </p>
        )}

        {events.map((event) => {
          const typeInfo = TYPE_LABELS[event.type];
          const isDisagreement = event.type === "disagreement";
          const isObjection = event.type === "objection";
          const isVerdict = event.type === "verdict";

          return (
            <div
              key={event.id}
              className={`
                rounded-xl p-4 transition-all duration-300 scene-bubble-enter
                ${isDisagreement
                  ? "bg-accent-danger/5 border border-accent-danger/20"
                  : isObjection
                    ? "bg-accent-warning/5 border border-accent-warning/20"
                    : isVerdict
                      ? "bg-accent-success/5 border border-accent-success/20"
                      : "bg-workspace-elevated/80 border border-workspace-border/50"
                }
              `}
            >
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-xl shrink-0">{event.agentAvatar}</span>
                <span className="text-[15px] font-semibold text-text-primary">
                  {event.agentName}
                </span>
                <span className={`text-[12px] font-semibold ml-auto ${typeInfo.style}`}>
                  {typeInfo.label}
                </span>
              </div>

              {/* Message */}
              <p className="text-[15px] text-text-secondary leading-relaxed">
                {event.message}
              </p>

              {/* Topic */}
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[12px] text-text-muted font-mono">Konu:</span>
                <span className="text-[13px] text-text-secondary font-medium">
                  {event.topic}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
