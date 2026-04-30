"use client";

import { ExternalLink, Pin, PinOff } from "lucide-react";
import { TOPIC_BY_ID } from "@/lib/regulations/topics";
import type {
  RegulationItemDTO,
  RegulationPriority,
} from "@/lib/regulations/types";

interface Props {
  item: RegulationItemDTO;
  onTogglePinned: (id: string, pinned: boolean) => void;
}

const PRIORITY_BADGE: Record<
  RegulationPriority,
  { label: string; className: string; dot: string }
> = {
  critical: {
    label: "Kritik",
    className: "bg-accent-danger/12 text-accent-danger border-accent-danger/30",
    dot: "bg-accent-danger",
  },
  high: {
    label: "Yüksek",
    className: "bg-accent-warning/12 text-accent-warning border-accent-warning/30",
    dot: "bg-accent-warning",
  },
  medium: {
    label: "Orta",
    className: "bg-accent-info/10 text-accent-info border-accent-info/30",
    dot: "bg-accent-info",
  },
  low: {
    label: "Düşük",
    className: "bg-workspace-elevated text-text-tertiary border-workspace-border",
    dot: "bg-text-tertiary",
  },
};

const SOURCE_LABEL: Record<string, string> = {
  "yargi-mcp": "Yargı MCP",
  "resmi-gazete": "Resmî Gazete",
  tcmb: "TCMB",
  bddk: "BDDK",
  kvkk: "KVKK",
  masak: "MASAK",
  gib: "GİB",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function RegulationCard({ item, onTogglePinned }: Props) {
  const badge = PRIORITY_BADGE[item.priority];
  const sourceLabel = SOURCE_LABEL[item.source] ?? item.source;
  const isPinned = Boolean(item.pinned);

  return (
    <article className="rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-soft hover:shadow-medium transition-shadow">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${badge.className}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
            {item.topics.map((topicId) => {
              const topic = TOPIC_BY_ID[topicId];
              if (!topic) return null;
              return (
                <span
                  key={topicId}
                  className="text-xs text-text-secondary px-2 py-0.5 rounded bg-workspace-elevated border border-workspace-border"
                >
                  {topic.label}
                </span>
              );
            })}
          </div>
          <h3 className="font-display text-base font-semibold text-text-primary leading-snug">
            {item.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onTogglePinned(item.id, !isPinned)}
          className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
            isPinned
              ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
              : "bg-workspace-surface border-workspace-border text-text-tertiary hover:text-text-secondary"
          }`}
          aria-label={isPinned ? "Pin'i kaldır" : "Pin'le"}
        >
          {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
        </button>
      </header>

      {item.summary && (
        <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 mb-3">
          {item.summary}
        </p>
      )}

      <footer className="flex items-center justify-between gap-3 pt-3 border-t border-workspace-border/60 text-xs text-text-tertiary">
        <span className="inline-flex items-center gap-2">
          <span>{formatDate(item.publishedAt)}</span>
          <span aria-hidden>·</span>
          <span>{sourceLabel}</span>
        </span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
          >
            Kaynağa Git <ExternalLink size={12} />
          </a>
        )}
      </footer>
    </article>
  );
}
