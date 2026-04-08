"use client";

import { useWorkspaceStore } from "@/lib/store";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Zap,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  running: "● ANALİZ EDİLİYOR",
  ready: "● HAZIR",
  complete: "✓ TAMAMLANDI",
  setup: "KURULUM",
};

const STATUS_COLORS: Record<string, string> = {
  running: "text-accent-primary animate-pulse",
  ready: "text-accent-success",
  complete: "text-accent-success",
  setup: "text-text-muted",
};

export function TopBar() {
  const job = useWorkspaceStore((s) => s.job);
  const isLeftCollapsed = useWorkspaceStore((s) => s.isLeftPanelCollapsed);
  const isRightCollapsed = useWorkspaceStore((s) => s.isRightPanelCollapsed);
  const toggleLeft = useWorkspaceStore((s) => s.toggleLeftPanel);
  const toggleRight = useWorkspaceStore((s) => s.toggleRightPanel);
  const loadDemo = useWorkspaceStore((s) => s.loadDemoScenario);
  const reset = useWorkspaceStore((s) => s.resetWorkspace);

  return (
    <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-workspace-border bg-workspace-surface z-50">
      {/* Sol bölüm */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLeft}
          className="p-1.5 rounded-md hover:bg-workspace-elevated text-text-tertiary hover:text-accent-primary transition-colors"
          title={isLeftCollapsed ? "Paneli göster" : "Paneli gizle"}
        >
          {isLeftCollapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-accent-primary tracking-tight">
            AGENTEX
          </span>
          <span className="text-2xs text-text-muted font-mono">
            Sözleşme İnceleme
          </span>
        </div>

        <div className="w-px h-4 bg-workspace-border" />

        {/* İş başlığı */}
        <span className="text-xs text-text-secondary font-mono truncate max-w-[200px]">
          {job.title}
        </span>

        {/* Durum */}
        {job.status !== "setup" && (
          <span
            className={`text-2xs font-mono ${
              STATUS_COLORS[job.status] ?? "text-text-muted"
            }`}
          >
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        )}
      </div>

      {/* Sağ bölüm */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => loadDemo()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-md hover:bg-accent-primary/15 transition-colors"
        >
          <Zap size={12} />
          DEMO
        </button>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-text-tertiary hover:text-text-secondary hover:bg-workspace-elevated rounded-md transition-colors"
        >
          <RotateCcw size={12} />
          SIFIRLA
        </button>

        <div className="w-px h-4 bg-workspace-border" />

        <button
          onClick={toggleRight}
          className="p-1.5 rounded-md hover:bg-workspace-elevated text-text-tertiary hover:text-accent-primary transition-colors"
          title={isRightCollapsed ? "Paneli göster" : "Paneli gizle"}
        >
          {isRightCollapsed ? (
            <PanelRightOpen size={16} />
          ) : (
            <PanelRightClose size={16} />
          )}
        </button>
      </div>
    </header>
  );
}
