"use client";

interface DecisionListCardProps {
  decisions: string[];
}

export function DecisionListCard({ decisions }: DecisionListCardProps) {
  return (
    <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-5">
        Ana Kararlar
      </h2>

      {decisions.length === 0 ? (
        <p className="text-base text-text-muted">Karar noktası bulunmuyor.</p>
      ) : (
        <div className="space-y-3">
          {decisions.map((decision, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-lg bg-workspace-bg/50 border border-workspace-border/30"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent-primary/15 text-accent-primary text-[13px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-[16px] text-text-primary leading-relaxed">
                {decision}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
