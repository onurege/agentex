"use client";

import { useCallback } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { runOrchestration } from "@/lib/orchestration";
import { Loader2 } from "lucide-react";

export function RunAnalysisButton() {
  const job = useWorkspaceStore((s) => s.job);
  const startAnalysis = useWorkspaceStore((s) => s.startAnalysis);

  const canRun =
    (job.activeScenarioId || job.document) &&
    job.document &&
    job.selectedAgents.length > 0 &&
    job.status !== "running";

  const isRunning = job.status === "running";
  const isComplete = job.status === "complete";

  const handleRun = useCallback(() => {
    if (!canRun) return;
    startAnalysis();
    runOrchestration();
  }, [canRun, startAnalysis]);

  if (isComplete) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-success/10 border border-accent-success/30 rounded-lg font-mono text-xs text-accent-success shadow-soft"
      >
        <div className="w-2 h-2 rounded-full bg-accent-success" />
        ANALİZ TAMAMLANDI ✓
      </div>
    );
  }

  return (
    <button
      onClick={handleRun}
      disabled={!canRun || isRunning}
      className={`
        pixel-btn w-full flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs transition-all
        ${isRunning
          ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/40 rounded-lg cursor-wait"
          : canRun
          ? "bg-accent-primary text-workspace-bg border border-accent-primary rounded-lg hover:bg-accent-primary/90 font-semibold shadow-glow-blue"
          : "bg-workspace-elevated text-text-muted border border-workspace-border rounded-lg cursor-not-allowed"
        }
      `}
    >
      {isRunning ? (
        <>
          <Loader2 size={13} className="animate-spin" />
          ANALİZ ÇALIŞIYOR...
        </>
      ) : (
        <>
          <span>▶</span>
          ANALİZİ BAŞLAT
        </>
      )}
    </button>
  );
}
