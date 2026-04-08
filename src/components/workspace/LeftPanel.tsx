"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { ScenarioSelector } from "../left-panel/ScenarioSelector";
import { DocumentUpload } from "../left-panel/DocumentUpload";
import { BusinessContextInput } from "../left-panel/BusinessContextInput";
import { AgentLibrary } from "../left-panel/AgentLibrary";
import { ChiefAgentSection } from "../left-panel/ChiefAgentSection";
import { RunAnalysisButton } from "../left-panel/RunAnalysisButton";

type InputMode = "scenario" | "upload";

export function LeftPanel() {
  const job = useWorkspaceStore((s) => s.job);
  const [inputMode, setInputMode] = useState<InputMode>(
    job.activeScenarioId ? "scenario" : "upload",
  );

  // Show setup controls when we have a document (from either mode)
  const hasDocument = !!job.document;
  const hasContext = job.businessContext.notes.length > 0;
  const hasScenario = !!job.activeScenarioId;

  // Sync mode when scenario is selected externally
  const effectiveMode = hasScenario && inputMode === "upload" ? "scenario" : inputMode;

  return (
    <div className="h-full flex flex-col border-r border-workspace-border bg-workspace-surface overflow-hidden">
      {/* Panel başlığı */}
      <div className="px-3 py-2.5 border-b border-workspace-border bg-workspace-elevated flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/20 rounded-md">
          <span className="text-xs">📁</span>
          <h2 className="text-2xs font-mono font-semibold text-accent-primary uppercase tracking-wider">
            İNCELEME KURULUMU
          </h2>
        </div>
      </div>

      {/* Kaydırılabilir içerik */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Input mode toggle */}
        <div className="flex gap-px border border-workspace-border rounded-lg overflow-hidden">
          <button
            onClick={() => setInputMode("scenario")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-2xs font-mono transition-all ${
              effectiveMode === "scenario"
                ? "bg-accent-primary/15 text-accent-primary font-semibold"
                : "text-text-muted hover:text-text-secondary hover:bg-workspace-elevated/50"
            }`}
          >
            📂 Demo Senaryolar
          </button>
          <button
            onClick={() => setInputMode("upload")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-2xs font-mono transition-all ${
              effectiveMode === "upload"
                ? "bg-accent-primary/15 text-accent-primary font-semibold"
                : "text-text-muted hover:text-text-secondary hover:bg-workspace-elevated/50"
            }`}
          >
            📄 Belge Yükle
          </button>
        </div>

        {/* Input source */}
        {effectiveMode === "scenario" ? (
          <ScenarioSelector />
        ) : (
          <DocumentUpload />
        )}

        {/* Document display (for scenario mode) */}
        {effectiveMode === "scenario" && hasScenario && <DocumentUpload />}

        {/* Setup controls — shown when document exists (either mode) */}
        {hasDocument && (
          <>
            <BusinessContextInput />
            {hasContext && job.chiefRecommendation && (
              <ChiefAgentSection />
            )}
            <AgentLibrary />
          </>
        )}
      </div>

      {/* Alt eylem */}
      <div className="p-3 border-t border-workspace-border">
        <RunAnalysisButton />
      </div>
    </div>
  );
}
