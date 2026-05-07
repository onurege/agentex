"use client";

import Link from "next/link";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { useSelectedStageAgents } from "@/lib/stage-agents";
import { SITE } from "@/lib/config/site";

export function BoardSummaryPanel() {
  const selectedAgentIds = useBoardroomFlowStore((s) => s.selectedAgentIds);
  const selectedAgents = useSelectedStageAgents(selectedAgentIds);
  const count = selectedAgents.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-text-primary">
          Seçili Kurul
        </h2>
        <Link
          href={SITE.paths.boardroomAgents}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium
                     text-accent-primary hover:bg-accent-primary/10
                     transition-colors duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Düzenle
        </Link>
      </div>

      <div>
        {count === 0 ? (
          <p className="text-sm text-text-muted">
            Henüz ajan seçilmedi.{" "}
            <Link href={SITE.paths.boardroomAgents} className="text-accent-primary hover:underline">
              Ajan seçimi yapın
            </Link>
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {selectedAgents.map((agent) => (
                <li key={agent.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center text-lg shrink-0">
                    {agent.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-text-primary truncate leading-tight">
                      {agent.name}
                    </p>
                    <p className="text-[13px] text-text-muted truncate">
                      {agent.title}
                    </p>
                  </div>
                </li>
              ))}
              <li className="flex items-center gap-3 pt-2 border-t border-workspace-border/40">
                <div className="w-9 h-9 rounded-full bg-workspace-bg border border-workspace-border flex items-center justify-center text-lg shrink-0">
                  👤
                </div>
                <p className="text-sm text-text-muted leading-tight">
                  <span className="font-medium text-text-secondary">Kurul Başkanı</span> otomatik
                </p>
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
