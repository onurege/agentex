"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { BOARD_TEMPLATES } from "@/lib/stage-agents";
import { useSelectedStageAgents } from "@/lib/stage-agents";
import { logClientActivity } from "@/lib/client-activity";
import { SITE } from "@/lib/config/site";

export default function BoardTemplatesPage() {
  const router = useRouter();
  const setSelectedAgentIds = useBoardroomFlowStore((s) => s.setSelectedAgentIds);

  const applyTemplate = useCallback(
    (templateId: string, templateName: string, agentIds: string[]) => {
      setSelectedAgentIds(agentIds);
      void logClientActivity({
        action: "template_applied",
        targetType: "template",
        targetId: templateId,
        summary: `"${templateName}" şablonu uygulandı`,
        module: "control_room",
        metadata: { agentIds },
      });
      router.push(SITE.paths.boardroomAgents);
    },
    [setSelectedAgentIds, router],
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Board Templates</h1>
        <p className="text-lg text-text-secondary">
          Hazır kurul şablonları ile hızlı başlangıç yapın.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {BOARD_TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} onApply={() => applyTemplate(t.id, t.name, t.agentIds)} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onApply,
}: {
  template: (typeof BOARD_TEMPLATES)[number];
  onApply: () => void;
}) {
  // Resolve effective agent names for display
  const agents = useSelectedStageAgents(template.agentIds);

  return (
    <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6 hover:border-accent-primary/20 transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{template.emoji}</span>
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{template.name}</h2>
          <p className="text-[14px] text-text-muted">{agents.length} ajan</p>
        </div>
      </div>

      <p className="text-base text-text-secondary leading-relaxed mb-4">
        {template.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {agents.map((a) => (
          <span
            key={a.id}
            className="px-2.5 py-1 rounded-md text-[13px] font-medium bg-workspace-elevated text-text-secondary border border-workspace-border"
          >
            {a.shortName}
          </span>
        ))}
      </div>

      <button
        onClick={onApply}
        className="px-5 py-2.5 rounded-lg text-base font-semibold
                   bg-accent-primary text-workspace-surface border border-accent-primary
                   hover:bg-accent-secondary transition-colors min-h-[44px]"
      >
        Şablonu Kullan
      </button>
    </div>
  );
}
