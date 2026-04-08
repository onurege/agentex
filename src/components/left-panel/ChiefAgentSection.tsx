"use client";

import { useWorkspaceStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";

export function ChiefAgentSection() {
  const recommendation = useWorkspaceStore((s) => s.job.chiefRecommendation);
  const status = useWorkspaceStore((s) => s.job.status);

  const severityLabel: Record<string, string> = {
    high: "🔴 YÜKSEK",
    medium: "🟡 ORTA",
    low: "🟢 DÜŞÜK",
  };

  if (!recommendation) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <label className="text-2xs font-mono text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
        🎯 BAŞ AJAN ANALİZİ
        <span className="ml-auto text-2xs font-mono bg-accent-success/15 border border-accent-success/30 text-accent-success px-1">✓</span>
      </label>

      {/* Risk kategorileri */}
      <div className="space-y-1">
        {recommendation.riskCategories.slice(0, 3).map((risk, i) => (
          <div
            key={i}
            className="px-2 py-1.5 bg-workspace-elevated border border-workspace-border rounded-md"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-xs font-mono font-medium text-text-primary">{risk.name}</p>
              <span className="text-2xs font-mono text-text-muted">
                {severityLabel[risk.severity] ?? risk.severity}
              </span>
            </div>
            <p className="text-2xs font-mono text-text-muted leading-relaxed line-clamp-2">
              {risk.description.slice(0, 80)}...
            </p>
          </div>
        ))}
      </div>

      {/* Önerilen ajanlar */}
      <div>
        <p className="text-2xs font-mono text-text-muted mb-1">ÖNERİLEN UZMANLAR:</p>
        <div className="flex flex-wrap gap-1">
          {recommendation.recommendedAgents.map((agentId) => {
            const agent = AGENTS[agentId];
            return (
              <span
                key={agentId}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent-primary/10 border border-accent-primary/20 rounded text-2xs font-mono text-accent-primary"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              >
                {agent.avatar} {agent.shortName}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
