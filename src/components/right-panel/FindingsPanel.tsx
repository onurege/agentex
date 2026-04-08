"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { FindingCategory, Finding } from "@/lib/types";

const CATEGORY_FILTERS: { id: FindingCategory | "all"; label: string; emoji: string }[] = [
  { id: "all",                label: "Tümü",      emoji: "📋" },
  { id: "critical-issue",    label: "Kritik",    emoji: "🚨" },
  { id: "missing-risky",     label: "Riskli",    emoji: "⚠️" },
  { id: "sufficient-positive", label: "Olumlu",  emoji: "✅" },
];

const SEVERITY_CONFIG: Record<string, { label: string; emoji: string; border: string; bg: string; text: string }> = {
  critical: { label: "KRİTİK",  emoji: "🚨", border: "border-accent-danger",  bg: "bg-accent-danger/8",   text: "text-accent-danger" },
  warning:  { label: "UYARI",   emoji: "⚠️", border: "border-accent-warning", bg: "bg-accent-warning/8",  text: "text-accent-warning" },
  info:     { label: "BİLGİ",   emoji: "ℹ️", border: "border-accent-info",    bg: "bg-accent-info/8",     text: "text-accent-info" },
  positive: { label: "OLUMLU",  emoji: "✅", border: "border-accent-success", bg: "bg-accent-success/8",  text: "text-accent-success" },
};

type ViewMode = "flat" | "grouped";

function groupBySection(findings: Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = f.section || "Genel";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return groups;
}

function FindingCard({ finding }: { finding: Finding }) {
  const agent = AGENTS[finding.agentId];
  const sev = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info;

  return (
    <div className={`p-2.5 border rounded-lg ${sev.border} ${sev.bg} space-y-1.5`}>
      <div className="flex items-start gap-2">
        <span className="text-sm flex-shrink-0 mt-0.5">{sev.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-mono font-semibold ${sev.text}`}>
            {finding.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-2xs font-mono text-text-muted">
              {agent?.avatar} {agent?.shortName}
            </span>
            {finding.clause && (
              <span className="text-2xs font-mono px-1 py-px rounded bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                {finding.clause}
              </span>
            )}
            {finding.section && (
              <span className="text-2xs font-mono text-text-muted">
                {finding.section}
              </span>
            )}
            <span
              className={`ml-auto text-2xs font-mono px-1.5 py-0 rounded border ${sev.border} ${sev.text}`}
            >
              {sev.label}
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs font-mono text-text-secondary leading-relaxed pl-6">
        {finding.description}
      </p>
    </div>
  );
}

export function FindingsPanel() {
  const findings = useWorkspaceStore((s) => s.job.findings);
  const [filter, setFilter] = useState<FindingCategory | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("flat");

  const filtered = filter === "all" ? findings : findings.filter((f) => f.category === filter);

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
        <div
          className="w-10 h-10 bg-workspace-elevated border border-workspace-border rounded-lg flex items-center justify-center mb-3 shadow-soft"
        >
          <span className="text-lg">🔍</span>
        </div>
        <p className="text-xs font-mono text-text-secondary">HENÜZ BULGU YOK</p>
        <p className="text-2xs font-mono text-text-muted mt-1">
          Analizi başlatarak bulguları görün
        </p>
      </div>
    );
  }

  // Count findings with clause/section refs
  const withRefs = findings.filter((f) => f.clause || f.section).length;

  return (
    <div className="p-2.5 space-y-2.5">
      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category filters */}
        <div className="flex gap-1 flex-wrap flex-1">
          {CATEGORY_FILTERS.map((cat) => {
            const count = cat.id === "all"
              ? findings.length
              : findings.filter((f) => f.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 text-2xs font-mono transition-all border
                  ${filter === cat.id
                    ? "bg-accent-primary/15 border-accent-primary/40 text-accent-primary"
                    : "border-workspace-border text-text-muted hover:text-text-secondary hover:bg-workspace-elevated"
                  }
                `}
                style={filter === cat.id ? { boxShadow: '0 1px 3px rgba(0,0,0,0.2)' } : {}}
              >
                {cat.emoji} {cat.label}
                {count > 0 && (
                  <span className={`ml-0.5 px-1 font-mono text-2xs ${filter === cat.id ? 'text-accent-primary' : 'text-text-muted'}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex gap-px border border-workspace-border rounded overflow-hidden">
          <button
            onClick={() => setViewMode("flat")}
            className={`px-2 py-0.5 text-2xs font-mono transition-all ${
              viewMode === "flat"
                ? "bg-accent-primary/15 text-accent-primary"
                : "text-text-muted hover:text-text-secondary hover:bg-workspace-elevated"
            }`}
          >
            Liste
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-2 py-0.5 text-2xs font-mono transition-all ${
              viewMode === "grouped"
                ? "bg-accent-primary/15 text-accent-primary"
                : "text-text-muted hover:text-text-secondary hover:bg-workspace-elevated"
            }`}
          >
            Bölüm
          </button>
        </div>
      </div>

      {/* Stats line */}
      {withRefs > 0 && (
        <p className="text-2xs font-mono text-text-muted">
          {withRefs}/{findings.length} bulgu madde/bölüm referanslı
        </p>
      )}

      {/* Findings content */}
      {viewMode === "flat" ? (
        <div className="space-y-1.5">
          {filtered.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(groupBySection(filtered).entries()).map(([section, sectionFindings]) => (
            <div key={section}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-2xs font-mono font-semibold text-accent-primary uppercase tracking-wider">
                  {section}
                </span>
                <span className="text-2xs font-mono text-text-muted">
                  ({sectionFindings.length})
                </span>
                <div className="flex-1 border-b border-workspace-border" />
              </div>
              <div className="space-y-1.5">
                {sectionFindings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
