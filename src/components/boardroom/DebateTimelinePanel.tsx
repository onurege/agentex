"use client";

// ============================================================
// DebateTimelinePanel — Konu bazlı gruplama
// ============================================================
//
// Olaylar artık `topic` alanına göre kümeleniyor; kullanıcı sürekli
// alta kaymadan tartışmanın yapısını görebiliyor. Her konu kart olarak
// çizilir, içinde ajanların katkıları kompakt satırlar halinde dizilir.
// En yeni konu en üstte; verdict olayı ayrı bir vurgu kartı olarak
// her zaman tepede durur.
// ============================================================

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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

interface TopicGroup {
  topic: string;
  events: DebateEvent[];
}

function groupByTopic(events: DebateEvent[]): {
  verdicts: DebateEvent[];
  groups: TopicGroup[];
} {
  const verdicts: DebateEvent[] = [];
  const groups: TopicGroup[] = [];
  for (const ev of events) {
    if (ev.type === "verdict") {
      verdicts.push(ev);
      continue;
    }
    const existing = groups.find((g) => g.topic === ev.topic);
    if (existing) {
      existing.events.push(ev);
    } else {
      groups.push({ topic: ev.topic, events: [ev] });
    }
  }
  // En son konuşulan konu en üstte; her grup içinde olaylar kronolojik kalır.
  groups.reverse();
  return { verdicts, groups };
}

export function DebateTimelinePanel({ events }: DebateTimelinePanelProps) {
  const { verdicts, groups } = useMemo(() => groupByTopic(events), [events]);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());

  const toggle = (topic: string) => {
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-workspace-bg">
      <div className="px-8 py-5 border-b border-workspace-border/30 flex items-end justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Tartışma Akışı
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            {events.length === 0
              ? "Tartışma başladığında konuşmalar burada görünecek."
              : `${groups.length} konu · ${events.length} konuşma · konu başına gruplandı`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {/* Verdict — varsa her zaman en tepede */}
        {verdicts.map((ev) => (
          <article
            key={ev.id}
            className="rounded-2xl p-5 bg-accent-success/[0.06] border-2 border-accent-success/40"
          >
            <header className="flex items-center gap-3 mb-2">
              <span className="text-2xl shrink-0">{ev.agentAvatar}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-widest text-accent-success">
                  Karar
                </p>
                <p className="text-base font-semibold text-text-primary">
                  {ev.agentName}
                </p>
              </div>
            </header>
            <p className="text-[15px] text-text-primary leading-relaxed">
              {ev.message}
            </p>
          </article>
        ))}

        {/* Konu kartları */}
        {groups.map((group, idx) => {
          const isCollapsed = collapsedTopics.has(group.topic);
          const isLatest = idx === 0;
          return (
            <article
              key={group.topic}
              className="rounded-2xl border border-workspace-border bg-workspace-surface overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(group.topic)}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 border-b border-workspace-border/50 hover:bg-workspace-elevated/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isLatest && (
                    <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse shrink-0" />
                  )}
                  <h3 className="font-display text-[15px] font-semibold text-text-primary truncate">
                    {group.topic}
                  </h3>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-text-muted">
                    {group.events.length} konuşma
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-text-muted transition-transform ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-workspace-border/40">
                  {group.events.map((ev) => {
                    const typeInfo = TYPE_LABELS[ev.type];
                    const isDisagreement = ev.type === "disagreement";
                    const isObjection = ev.type === "objection";
                    return (
                      <div
                        key={ev.id}
                        className={`px-5 py-4 flex gap-3 ${
                          isDisagreement
                            ? "bg-accent-danger/[0.04]"
                            : isObjection
                              ? "bg-accent-warning/[0.04]"
                              : ""
                        }`}
                      >
                        <span className="text-2xl shrink-0 leading-none mt-0.5">
                          {ev.agentAvatar}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-text-primary">
                              {ev.agentName}
                            </span>
                            <span
                              className={`text-[11px] font-semibold uppercase tracking-wide ${typeInfo.style}`}
                            >
                              {typeInfo.label}
                            </span>
                          </div>
                          <p className="text-[15px] text-text-secondary leading-relaxed">
                            {ev.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
