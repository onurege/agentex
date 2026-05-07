"use client";

import type { VerdictSeed } from "@/lib/boardroom-flow-store";

interface AgentPerspectivesCardProps {
  perspectives: VerdictSeed["agentPerspectives"];
}

export function AgentPerspectivesCard({ perspectives }: AgentPerspectivesCardProps) {
  return (
    <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-5">
        Uzman Görüşleri
      </h2>

      {perspectives.length === 0 ? (
        <p className="text-base text-text-muted">Uzman görüşü bulunmuyor.</p>
      ) : (
        <div className="space-y-4">
          {perspectives.map((p) => (
            <div key={p.agentId} className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-xl shrink-0">
                {p.avatar}
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-text-primary">
                  {p.agentName}
                </p>
                <p className="text-[16px] text-text-secondary leading-8 mt-0.5">
                  {p.position}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
