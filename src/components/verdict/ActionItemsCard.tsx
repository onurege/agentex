"use client";

interface ActionItemsCardProps {
  actionItems: string[];
}

export function ActionItemsCard({ actionItems }: ActionItemsCardProps) {
  return (
    <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-5">
        Önerilen Aksiyonlar
      </h2>

      {actionItems.length === 0 ? (
        <p className="text-base text-text-muted">
          Aksiyon maddesi bulunmuyor.
        </p>
      ) : (
        <div className="space-y-3">
          {actionItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-lg bg-workspace-bg/50 border border-workspace-border/30"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent-warning/15 text-accent-warning text-[13px] font-bold shrink-0 mt-0.5">
                !
              </span>
              <span className="text-[16px] text-text-primary leading-relaxed">
                {item}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
