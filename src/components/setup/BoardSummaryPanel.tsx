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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">
          Seçili Kurul
        </h2>
        <Link
          href={SITE.paths.boardroomAgents}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium
                     text-accent-primary hover:bg-accent-primary/10
                     transition-colors duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Kurulu Düzenle
        </Link>
      </div>

      <div className="rounded-xl bg-workspace-surface border border-workspace-border p-5">
        {count === 0 ? (
          <p className="text-base text-text-muted">
            Henüz ajan seçilmedi.{" "}
            <Link href={SITE.paths.boardroomAgents} className="text-accent-primary hover:underline">
              Ajan seçimi yapın
            </Link>
          </p>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {selectedAgents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center text-xl shrink-0">
                    {agent.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-medium text-text-primary truncate">
                      {agent.name}
                    </p>
                    <p className="text-[14px] text-text-secondary truncate">
                      {agent.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-base text-text-secondary mb-4">
              <span className="font-semibold text-text-primary">{count} uzman ajan</span>{" "}
              belgeyi farklı açılardan değerlendirecek.
            </div>

            <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-workspace-bg/60 border border-workspace-border/50">
              <span className="text-lg shrink-0 mt-0.5">👤</span>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                <span className="font-medium text-text-primary">Baş Ajan</span> tartışma sürecine otomatik olarak dahil edilir.
                Kurulu koordine eder ve son sentezi oluşturur.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
