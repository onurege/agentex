"use client";

import { useRef, useEffect, useCallback } from "react";
import type { DebateEvent } from "@/lib/boardroom-flow-store";

const STICK_THRESHOLD_PX = 32;

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
  const stickToBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= STICK_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-workspace-bg">
      <div className="px-8 py-5 border-b border-workspace-border/30 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Canlı Tartışma Akışı
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            {events.length} olay · son konuşmayı görmek için aşağı kaydırın
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-8 py-6 space-y-4 max-w-[1080px] w-full"
      >
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
                rounded-2xl p-6 transition-all duration-300 scene-bubble-enter
                ${isDisagreement
                  ? "bg-accent-danger/5 border border-accent-danger/30"
                  : isObjection
                    ? "bg-accent-warning/5 border border-accent-warning/30"
                    : isVerdict
                      ? "bg-accent-success/5 border border-accent-success/30"
                      : "bg-workspace-surface border border-workspace-border/60"
                }
              `}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl shrink-0">{event.agentAvatar}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-text-primary truncate">
                    {event.agentName}
                  </p>
                  <p className="text-xs text-text-muted font-mono uppercase tracking-wider mt-0.5">
                    Konu · {event.topic}
                  </p>
                </div>
                <span className={`text-[12px] font-semibold uppercase tracking-wide shrink-0 ${typeInfo.style}`}>
                  {typeInfo.label}
                </span>
              </div>
              <p className="text-[16px] text-text-primary leading-[1.7]">
                {event.message}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
