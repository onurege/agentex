"use client";

import type { BoardroomAgent } from "@/lib/boardroom-agents";
import type { AgentSceneState } from "@/lib/boardroom-flow-store";

interface BoardroomAgentSeatProps {
  agent: BoardroomAgent;
  sceneState?: AgentSceneState;
  isActiveSpeaker: boolean;
  isChief?: boolean;
}

const STATUS_LABELS: Record<AgentSceneState["status"], string> = {
  waiting: "Bekliyor",
  seated: "Yerleşti",
  reading: "Okuyor",
  analyzing: "İnceliyor",
  speaking: "Konuşuyor",
  objecting: "İtiraz Ediyor",
  defending: "Savunuyor",
  rebutting: "Yanıtlıyor",
  synthesizing: "Sonuçluyor",
  done: "Tamamladı",
};

export function BoardroomAgentSeat({
  agent,
  sceneState,
  isActiveSpeaker,
  isChief,
}: BoardroomAgentSeatProps) {
  const status = sceneState?.status ?? "waiting";
  const isActive = isActiveSpeaker;
  const isObjecting = status === "objecting";
  const isDefending = status === "defending";

  return (
    <div
      className={`
        flex flex-col items-center transition-all duration-300
        ${isActive ? "scale-110 z-10" : "scale-100"}
      `}
    >
      {/* Avatar ring */}
      <div
        className={`
          w-14 h-14 rounded-full flex items-center justify-center text-2xl
          border-2 transition-all duration-300
          ${isActive
            ? "border-accent-primary shadow-glow-blue bg-accent-primary/15"
            : isObjecting
              ? "border-accent-warning bg-accent-warning/10"
              : isDefending
                ? "border-accent-info bg-accent-info/10"
                : status === "done"
                  ? "border-accent-success/50 bg-accent-success/10"
                  : "border-workspace-border bg-workspace-elevated"
          }
          ${isActive ? "ring-2 ring-accent-primary/30 ring-offset-2 ring-offset-workspace-bg" : ""}
        `}
      >
        {agent.avatar}
      </div>

      {/* Name */}
      <span
        className={`
          text-[14px] font-semibold mt-1.5 transition-colors duration-200
          ${isActive ? "text-accent-primary" : "text-text-primary"}
        `}
      >
        {isChief ? "Baş Ajan" : agent.shortName}
      </span>

      {/* Status badge — always text, never color-only */}
      <span
        className={`
          font-mono text-[12px] font-medium mt-0.5 px-2 py-0.5 rounded-full
          ${isActive
            ? "bg-accent-primary/15 text-accent-primary"
            : isObjecting
              ? "bg-accent-warning/15 text-accent-warning"
              : isDefending
                ? "bg-accent-info/15 text-accent-info"
                : status === "done"
                  ? "bg-accent-success/10 text-accent-success"
                  : "text-text-muted"
          }
        `}
      >
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}
