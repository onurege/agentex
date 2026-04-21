"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useControlRoomStore } from "@/lib/control-room-store";
import { CreateAgentModal } from "@/components/agents/CreateAgentModal";

export default function AgentLibraryPage() {
  const getEffectiveAgent = useControlRoomStore((s) => s.getEffectiveAgent);
  const getProfile = useControlRoomStore((s) => s.getProfile);
  const getAllAgentIds = useControlRoomStore((s) => s.getAllAgentIds);
  const getCustomAgent = useControlRoomStore((s) => s.getCustomAgent);
  const archiveCustomAgent = useControlRoomStore((s) => s.archiveCustomAgent);
  const restoreCustomAgent = useControlRoomStore((s) => s.restoreCustomAgent);
  // Subscribe to customAgents so archive/restore re-render the list
  const customAgents = useControlRoomStore((s) => s.customAgents);

  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const agentIds = useMemo(
    () => getAllAgentIds({ includeArchived: showArchived }),
    [getAllAgentIds, showArchived, customAgents],
  );

  const hasArchived = useMemo(
    () => Object.values(customAgents).some((a) => a.archivedAt),
    [customAgents],
  );

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            Agent Library
          </h1>
          <p className="text-lg text-text-secondary">
            Kurul ajanlarını yönetin, CV ve prompt ayarlarını düzenleyin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasArchived ? (
            <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-workspace-surface border border-workspace-border text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 accent-accent-primary"
              />
              Arşivlenenleri göster
            </label>
          ) : null}

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-white border border-accent-primary hover:bg-accent-secondary transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yeni Ajan Oluştur
          </button>
        </div>
      </div>

      {/* Agent List */}
      <div className="space-y-3">
        {agentIds.map((agentId) => {
          const effective = getEffectiveAgent(agentId);
          if (!effective) return null;

          const profile = getProfile(agentId);
          const hasCustomCV =
            profile.cvPublished !== null || profile.cvLastSaved !== null;
          const custom = getCustomAgent(agentId);
          const isArchived = custom?.archivedAt != null;

          return (
            <div
              key={agentId}
              className={`flex items-center gap-4 p-5 rounded-xl border transition-colors ${
                isArchived
                  ? "bg-workspace-surface/50 border-workspace-border/50 opacity-60"
                  : "bg-workspace-surface border-workspace-border hover:border-accent-primary/20"
              }`}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-workspace-elevated border border-workspace-border flex items-center justify-center text-2xl shrink-0">
                {effective.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
                  <p className="text-lg font-semibold text-text-primary">
                    {effective.name}
                  </p>
                  {effective.isSystem && (
                    <span className="text-[12px] font-mono font-semibold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded">
                      Sistem
                    </span>
                  )}
                  {effective.isCustom && (
                    <span className="text-[12px] font-mono font-semibold text-accent-info bg-accent-info/10 px-2 py-0.5 rounded">
                      Özel
                    </span>
                  )}
                  {isArchived && (
                    <span className="text-[12px] font-mono font-semibold text-text-tertiary bg-workspace-elevated px-2 py-0.5 rounded">
                      Arşivlendi
                    </span>
                  )}
                  {hasCustomCV && !effective.isCustom && (
                    <span className="text-[12px] font-mono font-semibold text-accent-info bg-accent-info/10 px-2 py-0.5 rounded">
                      Özel CV
                    </span>
                  )}
                </div>
                <p className="text-base text-text-secondary">
                  {effective.title}
                </p>
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
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isArchived ? "bg-text-tertiary" : "bg-accent-success"
                  }`}
                />
                <span
                  className={`text-[14px] font-medium ${
                    isArchived ? "text-text-tertiary" : "text-accent-success"
                  }`}
                >
                  {isArchived ? "Arşivde" : "Aktif"}
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
                {effective.isCustom ? (
                  isArchived ? (
                    <button
                      onClick={() => restoreCustomAgent(agentId)}
                      className="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-workspace-elevated text-accent-primary border border-workspace-border hover:bg-accent-primary/10 transition-colors min-h-[40px]"
                    >
                      Geri Yükle
                    </button>
                  ) : (
                    <button
                      onClick={() => archiveCustomAgent(agentId)}
                      className="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-accent-danger/10 hover:text-accent-danger transition-colors min-h-[40px]"
                    >
                      Arşivle
                    </button>
                  )
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <CreateAgentModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
