"use client";

import type { VerdictSeed } from "@/lib/boardroom-flow-store";

interface PositionChangesCardProps {
  positionChanges: NonNullable<VerdictSeed["positionChanges"]>;
}

export function PositionChangesCard({ positionChanges }: PositionChangesCardProps) {
  if (positionChanges.length === 0) return null;

  return (
    <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-5">
        Pozisyon Değişiklikleri
      </h2>
      <p className="text-[14px] text-text-muted mb-4">
        Tartışma sırasında aşağıdaki ajanlar pozisyonlarını güncelledi.
      </p>

      <div className="space-y-4">
        {positionChanges.map((pc, i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-accent-primary/5 border border-accent-primary/15"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[15px] font-semibold text-text-primary">
                {pc.agentName}
              </span>
              <span className="text-[13px] text-text-muted">—</span>
              <span className="text-[14px] text-text-secondary">{pc.topic}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Previous */}
              <div className="flex items-start gap-2">
                <span className="text-[12px] font-mono text-text-muted uppercase tracking-wide shrink-0 mt-0.5 w-16">
                  Önceki
                </span>
                <p className="text-[14px] text-text-tertiary leading-relaxed line-through decoration-text-muted/30">
                  {pc.previousStance}
                </p>
              </div>

              {/* Updated */}
              <div className="flex items-start gap-2">
                <span className="text-[12px] font-mono text-accent-primary uppercase tracking-wide shrink-0 mt-0.5 w-16">
                  Güncel
                </span>
                <p className="text-[14px] text-text-primary leading-relaxed">
                  {pc.updatedStance}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
