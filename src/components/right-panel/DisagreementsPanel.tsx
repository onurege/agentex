"use client";

import { useWorkspaceStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { Swords, ArrowRight } from "lucide-react";

export function DisagreementsPanel() {
  const disagreements = useWorkspaceStore((s) => s.job.disagreements);

  if (disagreements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm text-text-secondary">Anlaşmazlık yok</p>
        <p className="text-xs text-text-muted mt-1">
          Ajan tartışmaları analiz sonrası burada görünecek
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <Swords size={14} />
        <span className="font-medium">{disagreements.length} anlaşmazlık bulundu</span>
      </div>

      {disagreements.map((d) => {
        const agentA = AGENTS[d.agentAId];
        const agentB = AGENTS[d.agentBId];
        const resolver = d.resolvedBy ? AGENTS[d.resolvedBy] : null;

        return (
          <div
            key={d.id}
            className="rounded-lg border border-accent-warning/15 overflow-hidden"
          >
            {/* Konu */}
            <div className="px-3 py-2 bg-accent-warning/5 border-b border-accent-warning/10">
              <p className="text-xs font-semibold text-text-primary">{d.topic}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-2xs">{agentA?.avatar}</span>
                <span className="text-2xs text-text-muted">{agentA?.shortName}</span>
                <span className="text-text-muted text-2xs">vs</span>
                <span className="text-2xs">{agentB?.avatar}</span>
                <span className="text-2xs text-text-muted">{agentB?.shortName}</span>
              </div>
            </div>

            {/* Görüşler */}
            <div className="p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-xs flex-shrink-0 mt-0.5">{agentA?.avatar}</span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {d.positionA}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs flex-shrink-0 mt-0.5">{agentB?.avatar}</span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {d.positionB}
                </p>
              </div>

              {/* Çözüm */}
              {d.resolution && (
                <div className="mt-2 pt-2 border-t border-workspace-border-subtle">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowRight size={10} className="text-accent-success" />
                    <span className="text-2xs font-medium text-accent-success uppercase tracking-wider">
                      Çözüm {resolver ? `(${resolver.shortName})` : ""}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {d.resolution}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
