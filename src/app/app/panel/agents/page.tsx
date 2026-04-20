"use client";

import Link from "next/link";
import { BOARDROOM_AGENTS } from "@/lib/boardroom-agents";
import { CHIEF_AGENT } from "@/lib/boardroom-flow-store";
import { useControlRoomStore } from "@/lib/control-room-store";

const ALL_AGENT_IDS = ["chief-agent", ...BOARDROOM_AGENTS.map((a) => a.id)];

export default function AgentLibraryPage() {
  const getEffectiveAgent = useControlRoomStore((s) => s.getEffectiveAgent);
  const getProfile = useControlRoomStore((s) => s.getProfile);

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            Agent Library
          </h1>
          <p className="text-lg text-text-secondary">
            Kurul ajanlarını yönetin, CV ve prompt ayarlarını düzenleyin.
          </p>
        </div>
      </div>

      {/* Agent List */}
      <div className="space-y-3">
        {ALL_AGENT_IDS.map((agentId) => {
          const effective = getEffectiveAgent(agentId);
          if (!effective) return null;

          const profile = getProfile(agentId);
          const hasCustomCV = profile.cvPublished !== null || profile.cvLastSaved !== null;
          const hasPublishedPrompt = profile.promptPublished !== null;

          return (
            <div
              key={agentId}
              className="flex items-center gap-4 p-5 rounded-xl bg-workspace-surface border border-workspace-border hover:border-accent-primary/20 transition-colors"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-workspace-elevated border border-workspace-border flex items-center justify-center text-2xl shrink-0">
                {effective.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-0.5">
                  <p className="text-lg font-semibold text-text-primary">
                    {effective.name}
                  </p>
                  {effective.isSystem && (
                    <span className="text-[12px] font-mono font-semibold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded">
                      Sistem
                    </span>
                  )}
                  {hasCustomCV && (
                    <span className="text-[12px] font-mono font-semibold text-accent-info bg-accent-info/10 px-2 py-0.5 rounded">
                      Özel CV
                    </span>
                  )}
                </div>
                <p className="text-base text-text-secondary">{effective.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {effective.expertise.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[13px] font-medium bg-workspace-elevated text-text-muted border border-workspace-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 shrink-0 mr-4">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-success" />
                <span className="text-[14px] font-medium text-accent-success">
                  Aktif
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/app/panel/agents/${agentId}/cv`}
                  className="px-4 py-2.5 rounded-lg text-[14px] font-medium
                             bg-workspace-elevated text-text-secondary
                             border border-workspace-border
                             hover:bg-workspace-border/50 hover:text-text-primary
                             transition-colors min-h-[40px]"
                >
                  CV Düzenle
                </Link>
                <Link
                  href={`/app/panel/agents/${agentId}/prompt`}
                  className="px-4 py-2.5 rounded-lg text-[14px] font-medium
                             bg-workspace-elevated text-text-secondary
                             border border-workspace-border
                             hover:bg-workspace-border/50 hover:text-text-primary
                             transition-colors min-h-[40px]"
                >
                  Prompt Düzenle
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
