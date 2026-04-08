"use client";

import { useWorkspaceStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { ArrowRight } from "lucide-react";

const PRIORITY_LABELS: Record<string, string> = {
  high: "yüksek",
  medium: "orta",
  low: "düşük",
};

export function CorrectionsPanel() {
  const corrections = useWorkspaceStore((s) => s.job.correctionRequests);

  if (corrections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm text-text-secondary">Düzeltme yok</p>
        <p className="text-xs text-text-muted mt-1">
          Çapraz ajan düzeltme talepleri burada görünecek
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {corrections.map((cr) => {
        const from = AGENTS[cr.fromAgentId];
        const to = AGENTS[cr.toAgentId];

        return (
          <div
            key={cr.id}
            className="p-3 rounded-lg bg-workspace-elevated border border-workspace-border-subtle space-y-2"
          >
            {/* Ajan akışı */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{from?.avatar}</span>
              <span className="text-2xs font-medium text-text-secondary">
                {from?.shortName}
              </span>
              <ArrowRight size={10} className="text-text-muted" />
              <span className="text-xs">{to?.avatar}</span>
              <span className="text-2xs font-medium text-text-secondary">
                {to?.shortName}
              </span>
              <span
                className={`badge ml-auto ${
                  cr.priority === "high"
                    ? "badge-critical"
                    : cr.priority === "medium"
                    ? "badge-warning"
                    : "badge-info"
                }`}
              >
                {PRIORITY_LABELS[cr.priority] ?? cr.priority}
              </span>
            </div>

            {/* Bulgu */}
            <p className="text-xs font-medium text-text-primary">{cr.finding}</p>

            {/* Düzeltme */}
            <p className="text-xs text-text-secondary leading-relaxed">
              {cr.correction}
            </p>
          </div>
        );
      })}
    </div>
  );
}
