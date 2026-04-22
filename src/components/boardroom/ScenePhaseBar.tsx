"use client";

import type { BoardroomPhase } from "@/lib/boardroom-flow-store";

interface ScenePhaseBarProps {
  currentPhase: BoardroomPhase;
}

const PHASES: { key: BoardroomPhase; label: string }[] = [
  { key: "kurul-toplaniyor", label: "Kurul Toplanıyor" },
  { key: "belge-inceleniyor", label: "Belge İnceleniyor" },
  { key: "tartisma", label: "Tartışma" },
  { key: "karar-olusturuluyor", label: "Karar Oluşuyor" },
];

function getPhaseStatus(
  phaseKey: BoardroomPhase,
  currentPhase: BoardroomPhase,
): "completed" | "active" | "upcoming" {
  const order = PHASES.map((p) => p.key);
  const currentIdx = order.indexOf(currentPhase);
  const phaseIdx = order.indexOf(phaseKey);

  if (currentPhase === "tamamlandi") return "completed";
  if (phaseIdx < currentIdx) return "completed";
  if (phaseIdx === currentIdx) return "active";
  return "upcoming";
}

export function ScenePhaseBar({ currentPhase }: ScenePhaseBarProps) {
  if (currentPhase === "idle") return null;

  return (
    <div className="flex items-center gap-1 bg-workspace-surface/60 rounded-lg p-1 border border-workspace-border/30">
      {PHASES.map((phase, i) => {
        const status = getPhaseStatus(phase.key, currentPhase);
        return (
          <div key={phase.key} className="flex items-center">
            <span
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-md text-[14px] font-medium
                transition-all duration-300
                ${status === "active"
                  ? "bg-accent-primary/15 text-accent-primary"
                  : status === "completed"
                    ? "text-accent-success"
                    : "text-text-muted"
                }
              `}
            >
              {status === "completed" && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {status === "active" && (
                <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
              )}
              {phase.label}
            </span>
            {i < PHASES.length - 1 && (
              <span className={`mx-1 text-[14px] ${status === "completed" ? "text-accent-success/40" : "text-text-muted/30"}`}>
                —
              </span>
            )}
          </div>
        );
      })}

      {currentPhase === "tamamlandi" && (
        <>
          <span className="mx-1 text-[14px] text-accent-success/40">—</span>
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[14px] font-semibold text-accent-success bg-accent-success/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Tamamlandı
          </span>
        </>
      )}
    </div>
  );
}
