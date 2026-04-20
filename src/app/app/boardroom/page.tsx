"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StageLayout } from "@/components/stage/StageLayout";
import { ScenePhaseBar } from "@/components/boardroom/ScenePhaseBar";
import { BoardroomAgentSeat } from "@/components/boardroom/BoardroomAgentSeat";
import { DocumentFocusCard } from "@/components/boardroom/DocumentFocusCard";
import { DebateTimelinePanel } from "@/components/boardroom/DebateTimelinePanel";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import {
  generateDebateSequence,
  generateVerdictSeed,
  convertAIResultToSteps,
  convertAIVerdictToSeed,
  type OrchestrationStep,
} from "@/lib/boardroom-orchestrator";
import { useSelectedStageAgents, useStageChiefAgent } from "@/lib/stage-agents";
import { saveBoardroomRun, buildRunSnapshot, buildFrozenAgentSnapshot } from "@/lib/run-history";
import { buildAnalysisInput, callBoardroomAnalysisAPI } from "@/lib/boardroom-engine";
import type { BoardroomAnalysisResult } from "@/lib/boardroom-engine/types";
import { SITE } from "@/lib/config/site";

// Seats sit on an ellipse around the oval table. Chief is always at
// index 0 → angle 0 → head of table (far from viewer under rotateX).
// Other seats spread evenly around the remaining circle.
const SEAT_RADIUS_X = 320;
const SEAT_RADIUS_Y = 180;

function computeSeatPosition(index: number, total: number): { x: number; y: number } {
  const angleDeg = (360 / Math.max(total, 1)) * index;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.sin(rad) * SEAT_RADIUS_X,
    y: -Math.cos(rad) * SEAT_RADIUS_Y,
  };
}

export default function BoardroomPage() {
  const router = useRouter();
  const selectedAgentIds = useBoardroomFlowStore((s) => s.selectedAgentIds);
  const parsedDocument = useBoardroomFlowStore((s) => s.parsedDocument);
  const selectedAgents = useSelectedStageAgents(selectedAgentIds);
  const chiefAgent = useStageChiefAgent();
  const uploadedFile = useBoardroomFlowStore((s) => s.uploadedFile);
  const contextNotes = useBoardroomFlowStore((s) => s.contextNotes);
  const boardroomStatus = useBoardroomFlowStore((s) => s.boardroomStatus);
  const boardroomPhase = useBoardroomFlowStore((s) => s.boardroomPhase);
  const activeSpeakerId = useBoardroomFlowStore((s) => s.activeSpeakerId);
  const highlightedTopic = useBoardroomFlowStore((s) => s.highlightedTopic);
  const debateTimeline = useBoardroomFlowStore((s) => s.debateTimeline);
  const agentSceneStates = useBoardroomFlowStore((s) => s.agentSceneStates);

  const setBoardroomPhase = useBoardroomFlowStore((s) => s.setBoardroomPhase);
  const setBoardroomStatus = useBoardroomFlowStore((s) => s.setBoardroomStatus);
  const setActiveSpeaker = useBoardroomFlowStore((s) => s.setActiveSpeaker);
  const setHighlightedTopic = useBoardroomFlowStore((s) => s.setHighlightedTopic);
  const addDebateEvent = useBoardroomFlowStore((s) => s.addDebateEvent);
  const setAgentSceneState = useBoardroomFlowStore((s) => s.setAgentSceneState);
  const completeBoardroom = useBoardroomFlowStore((s) => s.completeBoardroom);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasStartedRef = useRef(false);
  const [analysisMode, setAnalysisMode] = useState<"ai" | "fallback" | null>(null);
  const [modelInfo, setModelInfo] = useState<string | undefined>(undefined);
  // Store AI result ref so we can use it for verdict without re-deriving
  const aiResultRef = useRef<BoardroomAnalysisResult | null>(null);

  // Route guards
  useEffect(() => {
    if (selectedAgentIds.length === 0) {
      router.replace(SITE.paths.app);
    } else if (!parsedDocument && !uploadedFile) {
      router.replace(SITE.paths.setup);
    }
  }, [selectedAgentIds.length, parsedDocument, uploadedFile, router]);

  // Play steps through cinematic UI
  const playSteps = useCallback((
    steps: OrchestrationStep[],
    verdictFn: () => {
      verdict: import("@/lib/boardroom-flow-store").VerdictSeed;
      mode: "ai" | "ai-partial" | "fallback";
      model?: string;
      pipelineStages?: Array<{ stage: string; status: string; durationMs: number; agentId?: string; error?: string }>;
    },
  ) => {
    steps.forEach((step, i) => {
      const timer = setTimeout(() => {
        setBoardroomPhase(step.phase);
        setActiveSpeaker(step.agentId);
        setHighlightedTopic(step.topic);
        setAgentSceneState(step.agentId, {
          agentId: step.agentId,
          status: step.agentSceneStatus,
        });
        addDebateEvent({
          ...step.event,
          id: `event-${i}`,
          timestamp: Date.now(),
        });

        if (i === steps.length - 1) {
          const completeTimer = setTimeout(() => {
            const { verdict, mode, model, pipelineStages } = verdictFn();
            completeBoardroom(verdict);
            setAnalysisMode(mode === "ai-partial" ? "ai" : mode);
            setModelInfo(model);

            // Auto-save run
            const state = useBoardroomFlowStore.getState();
            const agentSnapshots = [
              buildFrozenAgentSnapshot(chiefAgent, true),
              ...selectedAgents.map((a) => buildFrozenAgentSnapshot(a, false)),
            ];
            const snapshot = buildRunSnapshot({
              selectedAgentIds: state.selectedAgentIds,
              agentSnapshots,
              documentName: state.uploadedFile?.name ?? parsedDocument?.fileName ?? "Belge",
              documentType: state.uploadedFile?.type ?? "unknown",
              documentSize: state.uploadedFile?.size ?? 0,
              contextNotes: state.contextNotes,
              debateTimeline: useBoardroomFlowStore.getState().debateTimeline,
              verdictSeed: verdict,
            });
            snapshot.analysisMode = mode;
            snapshot.modelInfo = model;
            snapshot.pipelineStages = pipelineStages;
            saveBoardroomRun(snapshot);
          }, 800);
          timersRef.current.push(completeTimer);
        }
      }, step.delayMs);
      timersRef.current.push(timer);
    });
  }, [
    setBoardroomPhase, setActiveSpeaker, setHighlightedTopic,
    setAgentSceneState, addDebateEvent, completeBoardroom,
    chiefAgent, selectedAgents, parsedDocument,
  ]);

  // Start orchestration — tries AI first, falls back to deterministic
  const startOrchestration = useCallback(async () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    setBoardroomStatus("running");

    // Try AI analysis
    try {
      const input = buildAnalysisInput(selectedAgents, parsedDocument, contextNotes);
      const aiResult = await callBoardroomAnalysisAPI(input);
      aiResultRef.current = aiResult;

      // Convert AI result to cinematic steps
      const steps = convertAIResultToSteps(aiResult, selectedAgents);
      playSteps(steps, () => ({
        verdict: convertAIVerdictToSeed(aiResult),
        mode: aiResult.analysisMode,
        model: aiResult.modelInfo,
        pipelineStages: aiResult.pipeline?.stages,
      }));
      return;
    } catch (err) {
      console.warn("AI boardroom analysis failed, falling back to deterministic:", err);
    }

    // Fallback: deterministic orchestration
    const steps = generateDebateSequence(selectedAgents, parsedDocument, contextNotes);
    playSteps(steps, () => ({
      verdict: generateVerdictSeed(selectedAgents, parsedDocument, useBoardroomFlowStore.getState().debateTimeline),
      mode: "fallback" as const,
    }));
  }, [
    selectedAgents, parsedDocument, contextNotes,
    setBoardroomStatus, playSteps,
  ]);

  // Auto-start
  useEffect(() => {
    if (selectedAgentIds.length > 0 && parsedDocument && boardroomStatus === "idle") {
      startOrchestration();
    }
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [selectedAgentIds.length, parsedDocument, boardroomStatus, startOrchestration]);

  // Guard render
  if (selectedAgentIds.length === 0 || (!parsedDocument && !uploadedFile)) {
    return (
      <StageLayout currentStep="boardroom">
        <div className="flex items-center justify-center h-full">
          <p className="text-lg text-text-muted">Yönlendiriliyor...</p>
        </div>
      </StageLayout>
    );
  }

  const boardroomAgents = [chiefAgent, ...selectedAgents];
  const fileName = uploadedFile?.name ?? parsedDocument?.fileName ?? "Belge";
  const isComplete = boardroomStatus === "complete";

  return (
    <StageLayout currentStep="boardroom">
      <div className="flex h-full">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Scene Header */}
          <div className="px-6 py-4 border-b border-workspace-border/30 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-text-primary">
                    Tartışma Sahnesi
                  </h1>
                  {analysisMode === "ai" && (
                    <span className="text-[12px] font-semibold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded">
                      AI
                    </span>
                  )}
                </div>
                <p className="text-base text-text-secondary mt-1 truncate">
                  Belge: <span className="text-text-primary font-medium">{fileName}</span>
                </p>
              </div>
              <ScenePhaseBar currentPhase={boardroomPhase} />
            </div>
          </div>

          {/* Boardroom Table Area — CSS 3D scene */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(59,130,246,0.04) 0%, transparent 70%)",
              }}
            />

            {/* Stage — perspective root. z-index layering per plan:
                z-0 connectors (added later), z-10 table, z-20 seats. */}
            <div
              className="relative w-[720px] h-[440px]"
              style={{
                perspective: "1400px",
                perspectiveOrigin: "50% 20%",
              }}
            >
              {/* Oval table — tilted away from the viewer */}
              <div
                className="absolute left-1/2 top-1/2 w-[420px] h-[240px] z-10 flex items-center justify-center"
                style={{
                  transform: "translate(-50%, -50%) rotateX(28deg)",
                  transformStyle: "preserve-3d",
                  borderRadius: "50% / 40%",
                  background:
                    "radial-gradient(ellipse at 50% 30%, rgba(26,39,64,0.95) 0%, rgba(13,22,40,0.98) 70%)",
                  border: "1px solid rgba(42,47,58,0.9)",
                  boxShadow:
                    "0 40px 80px -20px rgba(0,0,0,0.6), inset 0 0 60px rgba(59,130,246,0.08)",
                }}
              >
                <DocumentFocusCard fileName={fileName} currentTopic={highlightedTopic} />
              </div>

              {/* Seats — positioned on an ellipse around the table */}
              {boardroomAgents.map((agent, i) => {
                const { x, y } = computeSeatPosition(i, boardroomAgents.length);
                const sceneState = agentSceneStates[agent.id];
                const isActive = activeSpeakerId === agent.id;
                const status = sceneState?.status ?? "waiting";
                const isIdle = status === "waiting" || status === "seated";
                return (
                  <div
                    key={agent.id}
                    data-seat-id={agent.id}
                    className="absolute z-20"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: `translate(-50%, -50%) translateZ(${isActive ? 20 : 0}px)`,
                      filter: isIdle ? "saturate(0.85)" : "saturate(1)",
                      transition:
                        "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 600ms linear",
                    }}
                  >
                    <BoardroomAgentSeat
                      agent={agent}
                      sceneState={sceneState}
                      isActiveSpeaker={isActive}
                      isChief={agent.id === "chief-agent"}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Status Bar */}
          <div className="px-6 py-4 border-t border-workspace-border/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {!isComplete && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-primary animate-pulse" />
                  <p className="text-base text-text-secondary">
                    Durum:{" "}
                    <span className="text-text-primary font-medium">
                      {boardroomPhase === "kurul-toplaniyor" && "Kurul toplanıyor..."}
                      {boardroomPhase === "belge-inceleniyor" && "Ajanlar belgeyi inceliyor..."}
                      {boardroomPhase === "tartisma" && "Ajanlar belgeyi tartışıyor..."}
                      {boardroomPhase === "karar-olusturuluyor" && "Kurul kararı oluşturuluyor..."}
                      {boardroomPhase === "idle" && "AI analizi hazırlanıyor..."}
                    </span>
                  </p>
                </>
              )}
              {isComplete && (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-success">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p className="text-base text-accent-success font-medium">
                    Kurul tartışması tamamlandı
                  </p>
                </>
              )}
            </div>

            {isComplete ? (
              <Link
                href={SITE.paths.verdict}
                className="flex items-center gap-2 px-8 py-3 rounded-xl text-lg font-semibold bg-accent-primary text-white border border-accent-primary hover:bg-accent-secondary transition-all duration-150 min-h-[48px] shadow-glow-blue"
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

        <DebateTimelinePanel events={debateTimeline} />
      </div>
    </StageLayout>
  );
}
