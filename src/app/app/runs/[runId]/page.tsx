"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StageLayout } from "@/components/stage/StageLayout";
import { VerdictHero } from "@/components/verdict/VerdictHero";
import { DecisionListCard } from "@/components/verdict/DecisionListCard";
import { AgentPerspectivesCard } from "@/components/verdict/AgentPerspectivesCard";
import { DisagreementLedgerCard } from "@/components/verdict/DisagreementLedgerCard";
import { ActionItemsCard } from "@/components/verdict/ActionItemsCard";
import { PositionChangesCard } from "@/components/verdict/PositionChangesCard";
import { getBoardroomRunById } from "@/lib/run-history";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { SITE } from "@/lib/config/site";

export default function SavedRunVerdictPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const run = getBoardroomRunById(runId);
  const resetFlow = useBoardroomFlowStore((s) => s.resetFlow);

  if (!run) {
    return (
      <StageLayout currentStep="verdict">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-2xl font-semibold text-text-primary">Oturum Bulunamadı</p>
          <p className="text-lg text-text-secondary">Bu kayıtlı oturum artık mevcut değil.</p>
          <Link
            href={SITE.paths.app}
            className="px-6 py-3 rounded-xl text-base font-semibold bg-accent-primary text-white hover:bg-accent-secondary transition-colors"
          >
            Yeni Tartışma Başlat
          </Link>
        </div>
      </StageLayout>
    );
  }

  const { verdictSeed, agentSnapshots, documentName, debateTimeline, createdAt } = run;
  const expertAgents = agentSnapshots.filter((a) => !a.isChief);
  const hasCustomPrompts = agentSnapshots.some((a) => a.promptSnapshot !== null);
  const debateStats = {
    total: debateTimeline.length,
    objections: debateTimeline.filter((e) => e.type === "objection").length,
    disagreements: debateTimeline.filter((e) => e.type === "disagreement").length,
  };

  return (
    <StageLayout currentStep="verdict">
      <div className="flex flex-col px-6 py-10 max-w-5xl mx-auto w-full">
        {/* Saved run badge */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent-info/10 border border-accent-info/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-info">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-[14px] font-semibold text-accent-info">
              Kayıtlı Oturum — {new Date(createdAt).toLocaleDateString("tr-TR")}
            </span>
          </div>
        </div>

        {/* Hero */}
        <VerdictHero
          verdict={verdictSeed}
          documentName={documentName}
          agentCount={expertAgents.length}
        />

        {/* Board participants from frozen snapshots */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-[13px] font-mono text-text-muted uppercase tracking-wide mr-2">
            Kurul:
          </span>
          {agentSnapshots.map((agent) => (
            <div
              key={agent.id}
              className="w-9 h-9 rounded-full bg-workspace-surface border border-workspace-border flex items-center justify-center text-lg"
              title={`${agent.name}${agent.promptSnapshot ? ` · Prompt v${agent.promptSnapshot.promptVersion}` : ""}`}
            >
              {agent.avatar}
            </div>
          ))}
        </div>

        {/* Frozen config note */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <span className="text-[13px] text-text-muted">
            Donmuş yapılandırma ile kaydedildi
            {hasCustomPrompts && " · Özel prompt yapılandırması kullanıldı"}
          </span>
        </div>

        {/* Verdict grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <DecisionListCard decisions={verdictSeed.decisions} />
          <AgentPerspectivesCard perspectives={verdictSeed.agentPerspectives} />
          <DisagreementLedgerCard
            disagreements={verdictSeed.disagreements}
            resolvedDisagreements={verdictSeed.resolvedDisagreements}
            unresolvedDisagreements={verdictSeed.unresolvedDisagreements}
          />
          <ActionItemsCard actionItems={verdictSeed.actionItems} />
        </div>

        {/* Position changes — secondary section */}
        {verdictSeed.positionChanges && verdictSeed.positionChanges.length > 0 && (
          <div className="mb-8">
            <PositionChangesCard positionChanges={verdictSeed.positionChanges} />
          </div>
        )}

        {/* Debate summary */}
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6 mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Tartışma Özeti
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-workspace-bg/50">
              <p className="text-2xl font-bold text-text-primary">{debateStats.total}</p>
              <p className="text-[14px] text-text-secondary">Toplam Olay</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-workspace-bg/50">
              <p className="text-2xl font-bold text-accent-warning">{debateStats.objections}</p>
              <p className="text-[14px] text-text-secondary">İtiraz</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-workspace-bg/50">
              <p className="text-2xl font-bold text-accent-danger">{debateStats.disagreements}</p>
              <p className="text-[14px] text-text-secondary">Görüş Ayrılığı</p>
            </div>
          </div>

          {/* Key debate moments */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {debateTimeline
              .filter((e) => e.type !== "arrival" && e.type !== "synthesis")
              .slice(0, 10)
              .map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-workspace-bg/30">
                  <span className="text-lg shrink-0">{event.agentAvatar}</span>
                  <div className="min-w-0">
                    <span className="text-[14px] font-semibold text-text-primary">{event.agentName}</span>
                    <p className="text-[14px] text-text-secondary truncate">{event.message}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 pt-6 border-t border-workspace-border/30">
          <Link
            href={`/app/runs/${runId}/boardroom`}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold
                       bg-workspace-surface text-text-secondary border border-workspace-border
                       hover:bg-workspace-elevated hover:text-text-primary transition-colors min-h-[52px]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Boardroom&apos;u Oynat
          </Link>
          <button
            onClick={() => {
              resetFlow();
              router.push(SITE.paths.app);
            }}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold
                       bg-accent-primary text-white border border-accent-primary
                       hover:bg-accent-secondary transition-colors min-h-[52px]"
          >
            Yeni Tartışma Başlat
          </button>
        </div>
      </div>
    </StageLayout>
  );
}
