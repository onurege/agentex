"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StageLayout } from "@/components/stage/StageLayout";
import { ScenePhaseBar } from "@/components/boardroom/ScenePhaseBar";
import { BoardroomAgentSeat } from "@/components/boardroom/BoardroomAgentSeat";
import { DocumentFocusCard } from "@/components/boardroom/DocumentFocusCard";
import { DebateTimelinePanel } from "@/components/boardroom/DebateTimelinePanel";
import { getBoardroomRunById, type FrozenAgentSnapshot } from "@/lib/run-history";
import type { BoardroomPhase, AgentSceneState, DebateEvent } from "@/lib/boardroom-flow-store";
import type { BoardroomAgent } from "@/lib/boardroom-agents";

const SEAT_POSITIONS = [
  { className: "absolute -top-[70px] left-1/2 -translate-x-1/2" },
  { className: "absolute top-[15%] -left-[85px]" },
  { className: "absolute top-[55%] -left-[85px]" },
  { className: "absolute top-[15%] -right-[85px]" },
  { className: "absolute top-[55%] -right-[85px]" },
  { className: "absolute -bottom-[70px] left-1/2 -translate-x-1/2" },
];

function snapshotToBoardroomAgent(s: FrozenAgentSnapshot): BoardroomAgent {
  return {
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    title: s.title,
    avatar: s.avatar,
    color: "",
    characterLine: s.characterLine,
    description: "",
    expertise: s.expertise,
    bio: "",
    documentTypes: [],
    thinkingStyle: s.thinkingStyle,
  };
}

function inferPhase(event: DebateEvent): BoardroomPhase {
  if (event.type === "arrival") return "kurul-toplaniyor";
  if (event.type === "observation") return "belge-inceleniyor";
  if (event.type === "analysis" || event.type === "objection" || event.type === "disagreement" || event.type === "defense") return "tartisma";
  if (event.type.startsWith("rebuttal-")) return "tartisma";
  if (event.type === "synthesis") return "karar-olusturuluyor";
  if (event.type === "verdict") return "tamamlandi";
  return "tartisma";
}

function inferSceneStatus(eventType: DebateEvent["type"]): AgentSceneState["status"] {
  const map: Record<string, AgentSceneState["status"]> = {
    arrival: "seated",
    observation: "reading",
    analysis: "analyzing",
    objection: "objecting",
    disagreement: "speaking",
    defense: "defending",
    "rebuttal-defend": "rebutting",
    "rebuttal-challenge": "rebutting",
    "rebuttal-concede": "rebutting",
    "rebuttal-refine": "rebutting",
    synthesis: "synthesizing",
    verdict: "done",
  };
  return map[eventType] ?? "seated";
}

export default function BoardroomReplayPage() {
  const params = useParams();
  const runId = params.runId as string;
  const run = getBoardroomRunById(runId);

  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeline = run?.debateTimeline ?? [];
  const visibleEvents = timeline.slice(0, replayIndex);
  const currentEvent = replayIndex > 0 ? timeline[replayIndex - 1] : null;
  const isComplete = replayIndex >= timeline.length;
  const currentPhase = currentEvent ? inferPhase(currentEvent) : "idle";

  // Build scene states from visible events
  const agentSceneStates: Record<string, AgentSceneState> = {};
  visibleEvents.forEach((e) => {
    agentSceneStates[e.agentId] = { agentId: e.agentId, status: inferSceneStatus(e.type) };
  });
  // Mark all as done when complete
  if (isComplete && run) {
    run.agentSnapshots.forEach((a) => {
      agentSceneStates[a.id] = { agentId: a.id, status: "done" };
    });
  }

  // Auto-advance replay
  useEffect(() => {
    if (!isPlaying || isComplete || !run) return;
    timerRef.current = setTimeout(() => {
      setReplayIndex((prev) => prev + 1);
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [replayIndex, isPlaying, isComplete, run]);

  if (!run) {
    return (
      <StageLayout currentStep="boardroom">
        <div className="flex flex-col flex-1 items-center justify-center gap-4">
          <p className="text-2xl font-semibold text-text-primary">Oturum Bulunamadı</p>
          <Link href="/app" className="px-6 py-3 rounded-xl text-base font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-colors">
            Ana Sayfaya Dön
          </Link>
        </div>
      </StageLayout>
    );
  }

  const boardAgents = run.agentSnapshots.map(snapshotToBoardroomAgent);

  return (
    <StageLayout currentStep="boardroom">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-workspace-border/30 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-text-primary">Tekrar Oynatma</h1>
                  <span className="text-[13px] font-semibold text-accent-info bg-accent-info/10 px-3 py-1 rounded-full">
                    Kayıtlı Oturum
                  </span>
                </div>
                <p className="text-base text-text-secondary truncate">
                  Belge: <span className="text-text-primary font-medium">{run.documentName}</span>
                  {" · "}
                  {new Date(run.createdAt).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <ScenePhaseBar currentPhase={isComplete ? "tamamlandi" : currentPhase} />
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgb(var(--color-accent-info) / 0.08) 0%, transparent 70%)" }} />
            <div className="relative">
              <div className="w-[420px] h-[240px] rounded-[50%] flex items-center justify-center" style={{ background: "linear-gradient(180deg, rgb(var(--color-workspace-elevated) / 0.92) 0%, rgb(var(--color-workspace-surface) / 0.96) 100%)", border: "1px solid rgb(var(--color-workspace-border) / 0.8)", boxShadow: "0 8px 32px rgb(40 0 100 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.08)" }}>
                <DocumentFocusCard fileName={run.documentName} currentTopic={currentEvent?.topic ?? null} />
              </div>
              {boardAgents.map((agent, i) => {
                const pos = SEAT_POSITIONS[i % SEAT_POSITIONS.length];
                return (
                  <div key={agent.id} className={pos.className}>
                    <BoardroomAgentSeat
                      agent={agent}
                      sceneState={agentSceneStates[agent.id]}
                      isActiveSpeaker={currentEvent?.agentId === agent.id}
                      isChief={agent.id === "chief-agent"}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-workspace-border/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              {!isComplete && (
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50 transition-colors min-h-[40px]"
                >
                  {isPlaying ? "⏸ Duraklat" : "▶ Devam Et"}
                </button>
              )}
              <p className="text-base text-text-muted">
                {replayIndex} / {timeline.length} olay
              </p>
            </div>

            {isComplete ? (
              <Link
                href={`/app/runs/${runId}`}
                className="flex items-center gap-2 px-8 py-3 rounded-xl text-lg font-semibold bg-accent-primary text-workspace-surface border border-accent-primary hover:bg-accent-secondary transition-all duration-150 min-h-[48px] shadow-glow-blue"
              >
                <span>Kararı Gör</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ) : (
              <button disabled className="px-8 py-3 rounded-xl text-lg font-semibold bg-workspace-elevated text-text-muted border border-workspace-border cursor-not-allowed min-h-[48px]">
                Kararı Hazırla
              </button>
            )}
          </div>
        </div>

        <DebateTimelinePanel events={visibleEvents} />
      </div>
    </StageLayout>
  );
}
