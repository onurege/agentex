"use client";

import { useWorkspaceStore } from "@/lib/store";
import { EXPERT_AGENTS } from "@/lib/agents";
import { Check } from "lucide-react";

// Ajan renkleri — rol bazlı
const ROLE_ACCENT: Record<string, string> = {
  legal:   "border-agent-legal   text-agent-legal   bg-agent-legal/10",
  finance: "border-agent-finance text-agent-finance bg-agent-finance/10",
  tax:     "border-agent-tax     text-agent-tax     bg-agent-tax/10",
  sales:   "border-agent-sales   text-agent-sales   bg-agent-sales/10",
  product: "border-agent-product text-agent-product bg-agent-product/10",
};

const ROLE_CHECK: Record<string, string> = {
  legal:   "bg-agent-legal/20   border-agent-legal   text-agent-legal",
  finance: "bg-agent-finance/20 border-agent-finance text-agent-finance",
  tax:     "bg-agent-tax/20     border-agent-tax     text-agent-tax",
  sales:   "bg-agent-sales/20   border-agent-sales   text-agent-sales",
  product: "bg-agent-product/20 border-agent-product text-agent-product",
};

export function AgentLibrary() {
  const selectedAgents = useWorkspaceStore((s) => s.job.selectedAgents);
  const addAgent = useWorkspaceStore((s) => s.addAgent);
  const removeAgent = useWorkspaceStore((s) => s.removeAgent);
  const status = useWorkspaceStore((s) => s.job.status);
  const isDisabled = status === "running" || status === "complete";

  return (
    <div className="space-y-1.5">
      <label className="text-2xs font-mono text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
        🧑‍💼 UZMAN AJANLAR
        <span className="ml-auto font-mono text-text-muted">
          {selectedAgents.length}/{EXPERT_AGENTS.length}
        </span>
      </label>

      {/* Seçili sayı göstergesi — pixel bar */}
      <div className="flex gap-0.5 mb-1">
        {EXPERT_AGENTS.map((agent) => {
          const isSelected = selectedAgents.includes(agent.id);
          const roleClass = ROLE_ACCENT[agent.role] ?? "";
          return (
            <div
              key={agent.id}
              className={`flex-1 h-1 transition-all ${isSelected ? (roleClass.split(' ')[1] ?? 'bg-accent-primary') : 'bg-workspace-border'}`}
              style={{
                backgroundColor: isSelected ? undefined : undefined,
              }}
            />
          );
        })}
      </div>

      <div className="space-y-1">
        {EXPERT_AGENTS.map((agent) => {
          const isSelected = selectedAgents.includes(agent.id);
          const accent = ROLE_ACCENT[agent.role] ?? "border-workspace-border text-text-secondary bg-workspace-elevated";
          const checkAccent = ROLE_CHECK[agent.role] ?? "";

          return (
            <button
              key={agent.id}
              onClick={() => isSelected ? removeAgent(agent.id) : addAgent(agent.id)}
              disabled={isDisabled}
              className={`
                w-full flex items-center gap-2 px-2.5 py-2 border rounded-lg text-left transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isSelected
                  ? `border ${accent} ${accent.split(' ')[2] ?? ''}`
                  : "border border-workspace-border bg-workspace-elevated hover:border-workspace-border text-text-secondary hover:bg-workspace-elevated"
                }
              `}
            >
              {/* Avatar */}
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-2xs font-mono font-bold flex-shrink-0
                  ${isSelected ? `border ${accent.split(' ')[0]} ${accent.split(' ')[2] ?? 'bg-workspace-border/30'}` : 'bg-workspace-surface border border-workspace-border text-text-muted'}
                `}
              >
                {agent.avatar}
              </div>

              {/* Bilgi */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-mono font-medium truncate ${isSelected ? accent.split(' ')[1] : 'text-text-secondary'}`}>
                  {agent.shortName}
                </p>
                <p className="text-2xs font-mono text-text-muted truncate">
                  {agent.expertise.slice(0, 2).join(" · ")}
                </p>
              </div>

              {/* Seçim işareti */}
              <div className="flex-shrink-0">
                {isSelected ? (
                  <div className={`w-4 h-4 border flex items-center justify-center ${checkAccent}`}>
                    <Check size={9} />
                  </div>
                ) : (
                  <div className="w-4 h-4 border border-workspace-border bg-workspace-surface opacity-40 flex items-center justify-center">
                    <span className="text-2xs text-text-muted">+</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
