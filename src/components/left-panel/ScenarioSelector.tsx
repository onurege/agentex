"use client";

import { useWorkspaceStore } from "@/lib/store";
import { DEMO_SCENARIOS } from "@/lib/scenarios";

export function ScenarioSelector() {
  const activeScenarioId = useWorkspaceStore((s) => s.job.activeScenarioId);
  const switchScenario = useWorkspaceStore((s) => s.switchScenario);
  const status = useWorkspaceStore((s) => s.job.status);
  const isDisabled = status === "running";

  return (
    <div className="space-y-1.5">
      <label className="text-2xs font-mono text-text-tertiary uppercase tracking-wider">
        📂 SENARYO
      </label>

      <div className="space-y-1">
        {DEMO_SCENARIOS.map((scenario) => {
          const isActive = activeScenarioId === scenario.id;
          return (
            <button
              key={scenario.id}
              onClick={() => !isActive && switchScenario(scenario.id)}
              disabled={isDisabled}
              className={`
                w-full flex items-start gap-2 px-2.5 py-2 border rounded-lg text-left transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isActive
                  ? "bg-accent-primary/10 border-accent-primary/30 shadow-soft"
                  : "border-workspace-border bg-workspace-elevated hover:border-accent-primary/20 hover:bg-accent-primary/5"
                }
              `}
            >
              {/* Emoji */}
              <span className="text-base flex-shrink-0 mt-0.5">{scenario.emoji}</span>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-mono font-medium truncate ${isActive ? "text-accent-primary" : "text-text-secondary"}`}>
                  {scenario.shortName}
                </p>
                <p className="text-2xs font-mono text-text-muted truncate mt-0.5">
                  {scenario.document.pageCount} syf · {scenario.chiefRecommendation.recommendedAgents.length} ajan
                </p>
              </div>

              {/* Aktif işareti */}
              {isActive && (
                <div className="w-2 h-2 rounded-full bg-accent-primary flex-shrink-0 mt-1.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
