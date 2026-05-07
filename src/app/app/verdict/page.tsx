"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StageLayout } from "@/components/stage/StageLayout";
import { DecisionListCard } from "@/components/verdict/DecisionListCard";
import { AgentPerspectivesCard } from "@/components/verdict/AgentPerspectivesCard";
import { DisagreementLedgerCard } from "@/components/verdict/DisagreementLedgerCard";
import { ActionItemsCard } from "@/components/verdict/ActionItemsCard";
import { PositionChangesCard } from "@/components/verdict/PositionChangesCard";
import { VerdictActionBar } from "@/components/verdict/VerdictActionBar";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { useSelectedStageAgents, useStageChiefAgent } from "@/lib/stage-agents";
import { SITE } from "@/lib/config/site";
import { StaggerChildren, StaggerItem } from "@/lib/motion/primitives";

export default function VerdictPage() {
  const router = useRouter();
  const selectedAgentIds = useBoardroomFlowStore((s) => s.selectedAgentIds);
  const boardroomStatus = useBoardroomFlowStore((s) => s.boardroomStatus);
  const selectedAgents = useSelectedStageAgents(selectedAgentIds);
  const chiefAgent = useStageChiefAgent();
  const verdictSeed = useBoardroomFlowStore((s) => s.verdictSeed);
  const uploadedFile = useBoardroomFlowStore((s) => s.uploadedFile);
  const parsedDocument = useBoardroomFlowStore((s) => s.parsedDocument);
  const clientParty = useBoardroomFlowStore((s) => s.clientParty);
  const stance = useBoardroomFlowStore((s) => s.stance);

  const stanceLabel: Record<NonNullable<typeof stance>, string> = {
    aggressive: "Sert Savunma",
    favor: "Lehime · Dengeli",
    objective: "Objektif",
    winwin: "Uzlaşmacı",
  };

  // Route guards
  useEffect(() => {
    if (selectedAgentIds.length === 0) {
      router.replace(SITE.paths.boardroomAgents);
    } else if (boardroomStatus !== "complete" || !verdictSeed) {
      router.replace(SITE.paths.boardroom);
    }
  }, [selectedAgentIds.length, boardroomStatus, verdictSeed, router]);

  // Don't render until we confirm valid state
  if (!verdictSeed || boardroomStatus !== "complete") {
    return (
      <StageLayout currentStep="verdict">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-text-muted">Yönlendiriliyor...</p>
        </div>
      </StageLayout>
    );
  }

  const documentName = uploadedFile?.name ?? parsedDocument?.fileName ?? "Belge";
  const boardAgents = [chiefAgent, ...selectedAgents];

  const riskLabel: Record<typeof verdictSeed.riskLevel, string> = {
    high: "Yüksek Risk",
    medium: "Orta Risk",
    low: "Düşük Risk",
  };
  const riskTone: Record<typeof verdictSeed.riskLevel, string> = {
    high: "text-accent-danger bg-accent-danger/10 border-accent-danger/25",
    medium: "text-accent-warning bg-accent-warning/10 border-accent-warning/25",
    low: "text-accent-success bg-accent-success/10 border-accent-success/25",
  };
  const confidenceLabel: Record<NonNullable<typeof verdictSeed.confidenceLevel>, string> = {
    high: "Yüksek Güven",
    medium: "Orta Güven",
    low: "Düşük Güven",
  };
  const confidenceTone: Record<NonNullable<typeof verdictSeed.confidenceLevel>, string> = {
    high: "text-accent-success bg-accent-success/10 border-accent-success/25",
    medium: "text-accent-info bg-accent-info/10 border-accent-info/25",
    low: "text-accent-warning bg-accent-warning/10 border-accent-warning/25",
  };

  return (
    <StageLayout currentStep="verdict">
      <div className="flex-1 min-h-0 overflow-y-auto px-12 py-8">
        {/* Hero — sol metadata sütunu, sağ özet metni. Centered hero
            bırakıldı; göz tek bir yöne akıyor. */}
        <StaggerChildren
          stagger={0.12}
          className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8 mb-10"
        >
          <StaggerItem>
            <aside className="space-y-5">
              <header>
                <p className="text-[11px] font-mono uppercase tracking-widest text-text-muted mb-1.5">
                  Kurul Kararı
                </p>
                <h1 className="font-display text-[26px] leading-tight font-bold text-text-primary break-words">
                  {documentName}
                </h1>
                <p className="text-sm text-text-muted mt-1">
                  {selectedAgents.length} uzman ajan + Kurul Başkanı
                </p>
              </header>

              {clientParty && stance && (
                <div className="rounded-xl border border-workspace-border bg-workspace-surface p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      Temsil edilen taraf
                    </p>
                    <p className="text-[15px] font-semibold text-text-primary mt-0.5">
                      {clientParty}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      Tutum
                    </p>
                    <p className="text-[15px] font-semibold text-accent-primary mt-0.5">
                      {stanceLabel[stance]}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">
                  Kurul · {boardAgents.length} kişi
                </p>
                <div className="flex flex-wrap gap-2">
                  {boardAgents.map((agent) => (
                    <div
                      key={agent.id}
                      title={agent.name}
                      className="w-10 h-10 rounded-full border-2 border-workspace-border bg-workspace-surface flex items-center justify-center text-lg leading-none"
                    >
                      <span aria-hidden>{agent.avatar}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <VerdictActionBar
                  verdict={verdictSeed}
                  documentName={documentName}
                />
              </div>
            </aside>
          </StaggerItem>

          <StaggerItem>
            <div className="space-y-5">
              <p className="text-[18px] text-text-secondary leading-[1.7] max-w-[68ch]">
                {verdictSeed.summary}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold ${riskTone[verdictSeed.riskLevel]}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {riskLabel[verdictSeed.riskLevel]}
                </span>
                {verdictSeed.confidenceLevel && (
                  <span
                    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold ${confidenceTone[verdictSeed.confidenceLevel]}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    {confidenceLabel[verdictSeed.confidenceLevel]}
                  </span>
                )}
              </div>
            </div>
          </StaggerItem>
        </StaggerChildren>

        {/* Kart ızgarası — geniş ekranda 3 kolona çıkar */}
        <StaggerChildren
          stagger={0.1}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8"
        >
          <StaggerItem>
            <DecisionListCard decisions={verdictSeed.decisions} />
          </StaggerItem>
          <StaggerItem>
            <AgentPerspectivesCard perspectives={verdictSeed.agentPerspectives} />
          </StaggerItem>
          <StaggerItem>
            <DisagreementLedgerCard
              disagreements={verdictSeed.disagreements}
              resolvedDisagreements={verdictSeed.resolvedDisagreements}
              unresolvedDisagreements={verdictSeed.unresolvedDisagreements}
            />
          </StaggerItem>
          <StaggerItem>
            <ActionItemsCard actionItems={verdictSeed.actionItems} />
          </StaggerItem>
        </StaggerChildren>

        {verdictSeed.positionChanges && verdictSeed.positionChanges.length > 0 && (
          <StaggerItem className="mb-8 block">
            <PositionChangesCard positionChanges={verdictSeed.positionChanges} />
          </StaggerItem>
        )}
      </div>
    </StageLayout>
  );
}
