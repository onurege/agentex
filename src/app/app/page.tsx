"use client";

import { useState } from "react";
import { StageLayout } from "@/components/stage/StageLayout";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentDetailDrawer } from "@/components/agents/AgentDetailDrawer";
import { SelectedBoardBar } from "@/components/agents/SelectedBoardBar";
import { MAX_BOARD_SIZE } from "@/lib/boardroom-agents";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { useStageAgents, type StageAgent } from "@/lib/stage-agents";
import { MigrationBanner } from "@/components/app/MigrationBanner";
import { StaggerChildren, StaggerItem } from "@/lib/motion/primitives";

export default function AgentGalleryPage() {
  const selectedAgentIds = useBoardroomFlowStore((s) => s.selectedAgentIds);
  const selectAgent = useBoardroomFlowStore((s) => s.selectAgent);
  const deselectAgent = useBoardroomFlowStore((s) => s.deselectAgent);

  const stageAgents = useStageAgents();
  const selectedAgents = stageAgents.filter((a) => selectedAgentIds.includes(a.id));

  const [previewAgent, setPreviewAgent] = useState<StageAgent | null>(null);

  const selectedSet = new Set(selectedAgentIds);

  return (
    <StageLayout currentStep="agent-gallery">
      {/* Scrollable content with bottom padding for the fixed bar */}
      <div className="flex flex-col items-center px-6 py-10 pb-32">
        {/* Migration banner — only renders when db mode + unmigrated local data */}
        <div className="w-full max-w-[1080px]">
          <MigrationBanner />
        </div>

        {/* Header */}
        <div className="text-center mb-10 max-w-2xl">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">
            Uzman Ajanlar
          </h1>
          <p className="text-xl text-text-secondary leading-relaxed">
            Kurulunuzu oluşturmak için uzman ajanları seçin.
            <br />
            <span className="text-text-muted text-lg">
              En az 2, en fazla {MAX_BOARD_SIZE} ajan seçebilirsiniz.
            </span>
          </p>
        </div>

        {/* Agent Grid — uses published effective data */}
        <StaggerChildren
          stagger={0.06}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-[1080px]"
        >
          {stageAgents.map((agent) => (
            <StaggerItem key={agent.id}>
              <AgentCard
                agent={agent}
                isSelected={selectedSet.has(agent.id)}
                onSelect={() => selectAgent(agent.id)}
                onDeselect={() => deselectAgent(agent.id)}
                onViewDetail={() => setPreviewAgent(agent)}
              />
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>

      {/* Bottom board bar — always visible */}
      <SelectedBoardBar selectedAgents={selectedAgents} />

      {/* Agent detail drawer */}
      <AgentDetailDrawer
        agent={previewAgent}
        isSelected={previewAgent ? selectedSet.has(previewAgent.id) : false}
        onSelect={() => {
          if (previewAgent) selectAgent(previewAgent.id);
        }}
        onDeselect={() => {
          if (previewAgent) deselectAgent(previewAgent.id);
        }}
        onClose={() => setPreviewAgent(null)}
      />
    </StageLayout>
  );
}
