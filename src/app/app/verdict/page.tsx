"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StageLayout } from "@/components/stage/StageLayout";
import { VerdictHero } from "@/components/verdict/VerdictHero";
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

  return (
    <StageLayout currentStep="verdict">
      <StaggerChildren
        stagger={0.15}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col px-12 py-10 w-full"
      >
        {/* Hero */}
        <StaggerItem>
          <VerdictHero
            verdict={verdictSeed}
            documentName={documentName}
            agentCount={selectedAgents.length}
          />
        </StaggerItem>

        {/* Representation badge — shows the stance applied to this run */}
        {clientParty && stance && (
          <StaggerItem className="flex items-center justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-workspace-elevated border border-workspace-border text-[13px]">
              <span className="text-text-muted">Temsil edilen taraf:</span>
              <span className="font-semibold text-text-primary">{clientParty}</span>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted">Tutum:</span>
              <span className="font-semibold text-accent-primary">
                {stanceLabel[stance]}
              </span>
            </div>
          </StaggerItem>
        )}

        {/* Board participants — compact summary */}
        <StaggerItem className="flex items-center justify-center gap-2 mb-10">
          <span className="text-[13px] font-mono text-text-muted uppercase tracking-wide mr-2">
            Kurul:
          </span>
          {boardAgents.map((agent) => (
            <div
              key={agent.id}
              className="w-9 h-9 rounded-full bg-workspace-surface border border-workspace-border flex items-center justify-center text-lg"
              title={agent.name}
            >
              {agent.avatar}
            </div>
          ))}
        </StaggerItem>

        {/* Main verdict grid — each card staggers in */}
        <StaggerChildren
          stagger={0.12}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
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

        {/* Position changes — secondary section */}
        {verdictSeed.positionChanges && verdictSeed.positionChanges.length > 0 && (
          <StaggerItem className="mb-8">
            <PositionChangesCard positionChanges={verdictSeed.positionChanges} />
          </StaggerItem>
        )}

        {/* Action bar */}
        <StaggerItem>
          <VerdictActionBar
            verdict={verdictSeed}
            documentName={documentName}
          />
        </StaggerItem>
      </StaggerChildren>
    </StageLayout>
  );
}
