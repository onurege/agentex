"use client";

import { useWorkspaceStore, RightPanelTab } from "@/lib/store";
import { ActivityStream } from "../right-panel/ActivityStream";
import { FindingsPanel } from "../right-panel/FindingsPanel";
import { DisagreementsPanel } from "../right-panel/DisagreementsPanel";
import { CorrectionsPanel } from "../right-panel/CorrectionsPanel";
import { ManagerSummaryPanel } from "../right-panel/ManagerSummaryPanel";
import { RevisionsPanel } from "../right-panel/RevisionsPanel";
import {
  Activity,
  Search,
  AlertTriangle,
  GitCompare,
  FileText,
  Pencil,
} from "lucide-react";

const TABS: { id: RightPanelTab; label: string; icon: React.ReactNode; emoji: string }[] = [
  { id: "activity",      label: "Aktivite",    icon: <Activity size={11} />,       emoji: "📡" },
  { id: "findings",      label: "Bulgular",    icon: <Search size={11} />,         emoji: "🔍" },
  { id: "disagreements", label: "Tartışmalar", icon: <AlertTriangle size={11} />,  emoji: "💬" },
  { id: "corrections",   label: "Düzeltme",    icon: <GitCompare size={11} />,     emoji: "✏️" },
  { id: "summary",       label: "Özet",        icon: <FileText size={11} />,       emoji: "📋" },
  { id: "revisions",     label: "Revizyon",    icon: <Pencil size={11} />,         emoji: "📝" },
];

export function RightPanel() {
  const activeTab = useWorkspaceStore((s) => s.rightPanelTab);
  const setTab = useWorkspaceStore((s) => s.setRightPanelTab);
  const job = useWorkspaceStore((s) => s.job);

  const isComplete = job.status === "complete";

  return (
    <div className="h-full flex flex-col border-l border-workspace-border bg-workspace-surface overflow-hidden">
      {/* Panel başlık */}
      <div className="px-3 py-2.5 border-b border-workspace-border bg-workspace-elevated flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/20 rounded-md">
          <span className="text-xs">📊</span>
          <h2 className="text-2xs font-mono font-semibold text-accent-primary uppercase tracking-wider">
            SONUÇ PANELİ
          </h2>
        </div>
        {isComplete && (
          <div className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-accent-success/10 border border-accent-success/20 rounded-md">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-success" />
            <span className="text-2xs font-mono text-accent-success">TAMAM</span>
          </div>
        )}
      </div>

      {/* Sekme çubuğu */}
      <div className="flex-shrink-0 border-b border-workspace-border bg-workspace-bg/50">
        <div className="grid grid-cols-3 gap-px p-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDisabled =
              !isComplete &&
              tab.id !== "activity" &&
              job.status !== "running";

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setTab(tab.id)}
                disabled={isDisabled}
                className={`
                  flex items-center justify-center gap-1 px-1.5 py-1.5 text-2xs font-mono whitespace-nowrap rounded transition-all
                  ${isActive
                    ? "bg-workspace-elevated text-accent-primary border border-accent-primary/20"
                    : isDisabled
                    ? "text-text-muted/30 cursor-not-allowed bg-workspace-bg/30"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-workspace-elevated/50 border border-transparent hover:border-workspace-border"
                  }
                `}
              >
                <span>{tab.emoji}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel içeriği */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "activity" && <ActivityStream />}
        {activeTab === "findings" && <FindingsPanel />}
        {activeTab === "disagreements" && <DisagreementsPanel />}
        {activeTab === "corrections" && <CorrectionsPanel />}
        {activeTab === "summary" && <ManagerSummaryPanel />}
        {activeTab === "revisions" && <RevisionsPanel />}
      </div>
    </div>
  );
}
