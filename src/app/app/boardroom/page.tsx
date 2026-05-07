"use client";

import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StageLayout } from "@/components/stage/StageLayout";
import { ScenePhaseBar } from "@/components/boardroom/ScenePhaseBar";
import { BoardroomAgentSeat } from "@/components/boardroom/BoardroomAgentSeat";
import { DocumentFocusCard } from "@/components/boardroom/DocumentFocusCard";
import { DebateTimelinePanel } from "@/components/boardroom/DebateTimelinePanel";
import { SpotlightFocus } from "@/lib/motion/primitives";
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
import { applyMask, reverseMaskInResult } from "@/lib/boardroom-engine/mask";
import type { ParsedDocument } from "@/lib/ingestion/types";
import { SITE } from "@/lib/config/site";

// Seats sit on an ellipse around the oval table. Chief is always at
export default function BoardroomPage() {
  const router = useRouter();
  const selectedAgentIds = useBoardroomFlowStore((s) => s.selectedAgentIds);
  const parsedDocument = useBoardroomFlowStore((s) => s.parsedDocument);
  const selectedAgents = useSelectedStageAgents(selectedAgentIds);
  const chiefAgent = useStageChiefAgent();
  const uploadedFile = useBoardroomFlowStore((s) => s.uploadedFile);
  const contextNotes = useBoardroomFlowStore((s) => s.contextNotes);
  const clientParty = useBoardroomFlowStore((s) => s.clientParty);
  const stance = useBoardroomFlowStore((s) => s.stance);
  const maskMappings = useBoardroomFlowStore((s) => s.maskMappings);
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
      router.replace(SITE.paths.boardroomAgents);
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
            // Faz 4: pull redline payload from the AI result. Only
            // present when the AI path ran successfully AND the
            // uploaded document was a DOCX (PDF/TXT carry no base64).
            const aiResult = aiResultRef.current;
            const flatProposals = aiResult?.pipeline?.agentResults
              ?.flatMap((ar) => ar.editProposals ?? []) ?? [];

            const snapshot = buildRunSnapshot({
              selectedAgentIds: state.selectedAgentIds,
              agentSnapshots,
              documentName: state.uploadedFile?.name ?? parsedDocument?.fileName ?? "Belge",
              documentType: state.uploadedFile?.type ?? "unknown",
              documentSize: state.uploadedFile?.size ?? 0,
              contextNotes: state.contextNotes,
              clientParty: state.clientParty,
              stance: state.stance ?? "objective",
              debateTimeline: useBoardroomFlowStore.getState().debateTimeline,
              verdictSeed: verdict,
              originalDocxBase64: parsedDocument?.originalDocxBase64 ?? null,
              editProposals: flatProposals,
              arbitratedEdits: aiResult?.arbitratedEdits ?? [],
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
      // Mask sensitive fields before sending. The reverse on the result
      // restores originals so the rest of the pipeline (verdict, redline,
      // DB persistence) only ever sees real values.
      const maskedDoc: ParsedDocument | null = parsedDocument && maskMappings.length > 0
        ? {
            ...parsedDocument,
            fullText: parsedDocument.fullText
              ? applyMask(parsedDocument.fullText, maskMappings)
              : parsedDocument.fullText,
            sections: parsedDocument.sections.map((s) => ({
              ...s,
              title: applyMask(s.title, maskMappings),
              content: applyMask(s.content, maskMappings),
            })),
          }
        : parsedDocument;

      const input = buildAnalysisInput(
        selectedAgents,
        maskedDoc,
        applyMask(contextNotes, maskMappings),
        applyMask(clientParty, maskMappings),
        stance ?? "objective",
      );
      const rawResult = await callBoardroomAnalysisAPI(input);
      const aiResult = maskMappings.length > 0
        ? reverseMaskInResult(rawResult, maskMappings)
        : rawResult;
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
    selectedAgents, parsedDocument, contextNotes, clientParty, stance, maskMappings,
    setBoardroomStatus, playSteps,
  ]);

  // Auto-start — fires once when the page is idle and the inputs are ready.
  // hasStartedRef inside startOrchestration guards against duplicate kicks.
  useEffect(() => {
    if (selectedAgentIds.length > 0 && parsedDocument && boardroomStatus === "idle") {
      startOrchestration();
    }
  }, [selectedAgentIds.length, parsedDocument, boardroomStatus, startOrchestration]);

  // Timer cleanup runs ONLY on unmount. Keeping it tied to the deps above
  // tore pending playSteps timers down whenever the callback identity
  // churned mid-run (Zustand selectors return fresh arrays on every
  // render → playSteps recreated → startOrchestration recreated →
  // auto-start effect re-ran → previous cleanup wiped the scene).
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  // Derive the current disagreement pair: one agent objecting, another
  // defending at the same moment. Hooks must run before the guard
  // return below so they stay in consistent order across renders.
  const disagreementPair = useMemo(() => {
    let objectorId: string | null = null;
    let defenderId: string | null = null;
    for (const [agentId, state] of Object.entries(agentSceneStates)) {
      if (!state) continue;
      if (state.status === "objecting" && !objectorId) objectorId = agentId;
      if (state.status === "defending" && !defenderId) defenderId = agentId;
    }
    if (objectorId && defenderId && objectorId !== defenderId) {
      return { fromId: objectorId, toId: defenderId };
    }
    return null;
  }, [agentSceneStates]);

  const stageRef = useRef<HTMLDivElement>(null);

  // Guard render
  if (selectedAgentIds.length === 0 || (!parsedDocument && !uploadedFile)) {
    return (
      <StageLayout currentStep="boardroom">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-text-muted">Yönlendiriliyor...</p>
        </div>
      </StageLayout>
    );
  }

  const boardroomAgents = [chiefAgent, ...selectedAgents];
  const fileName = uploadedFile?.name ?? parsedDocument?.fileName ?? "Belge";
  const isComplete = boardroomStatus === "complete";

  const phaseLabel: Record<typeof boardroomPhase, string> = {
    "kurul-toplaniyor": "Kurul toplanıyor…",
    "belge-inceleniyor": "Uzmanlar sözleşmeyi inceliyor…",
    "tartisma": "Ajanlar düzeltme önerilerini paylaşıyor…",
    "karar-olusturuluyor": "Kurul Başkanı görüş ayrılıklarını değerlendiriyor…",
    "idle": "AI analizi hazırlanıyor…",
    "tamamlandi": "Tartışma tamamlandı.",
  };

  return (
    <StageLayout currentStep="boardroom">
      {/* Compact tek satır header — sahne başlığı + dosya + faz */}
      <div className="px-8 py-4 border-b border-workspace-border/30 shrink-0 flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-6">
        <div className="min-w-0 flex items-center gap-3 flex-1">
          <h1 className="text-xl font-bold text-text-primary shrink-0">
            Tartışma Sahnesi
          </h1>
          {analysisMode === "ai" && (
            <span className="text-[11px] font-semibold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded shrink-0">
              AI
            </span>
          )}
          <span className="text-text-muted shrink-0">·</span>
          <span className="text-sm text-text-secondary truncate">
            <span className="text-text-primary font-medium">{fileName}</span>
          </span>
        </div>
        <ScenePhaseBar currentPhase={boardroomPhase} />
      </div>

      {/* 2 kolon: SOL kompakt sahne paneli, SAĞ büyük tartışma akışı */}
      <div className="flex flex-1 min-h-0">
        <aside
          ref={stageRef}
          className="w-[320px] shrink-0 border-r border-workspace-border/30 bg-workspace-surface/40 flex flex-col"
        >
          {/* Mini toplantı masası — temiz SVG'li tepeden bakış. */}
          <div className="px-5 pt-5 pb-4 border-b border-workspace-border/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                Toplantı Masası
              </span>
              {activeSpeakerId && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-accent-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                  Konuşuyor
                </span>
              )}
            </div>

            <div className="relative w-full aspect-[16/9]">
              <svg
                viewBox="0 0 160 90"
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <radialGradient id="table-grad" cx="50%" cy="35%" r="65%">
                    <stop
                      offset="0%"
                      stopColor="rgb(var(--color-accent-info))"
                      stopOpacity="0.22"
                    />
                    <stop
                      offset="100%"
                      stopColor="rgb(var(--color-workspace-elevated))"
                      stopOpacity="0.4"
                    />
                  </radialGradient>
                </defs>
                <ellipse
                  cx="80"
                  cy="45"
                  rx="46"
                  ry="20"
                  fill="url(#table-grad)"
                  stroke="rgb(var(--color-workspace-border))"
                  strokeWidth="0.6"
                />
              </svg>

              {/* Çevredeki ajan koltukları */}
              {boardroomAgents.map((agent, i) => {
                const total = Math.max(boardroomAgents.length, 1);
                const angle = (2 * Math.PI * i) / total - Math.PI / 2;
                const cx = 50 + Math.cos(angle) * 44;
                const cy = 50 + Math.sin(angle) * 38;
                const isActive = activeSpeakerId === agent.id;
                const isChief = agent.id === "chief-agent";
                return (
                  <div
                    key={agent.id}
                    title={agent.name}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition-all duration-200 ${
                      isActive
                        ? "border-accent-primary bg-accent-primary/15 scale-110 shadow-glow-blue z-10"
                        : isChief
                          ? "border-accent-info/60 bg-workspace-surface"
                          : "border-workspace-border bg-workspace-surface"
                    }`}
                    style={{ left: `${cx}%`, top: `${cy}%` }}
                  >
                    {agent.avatar}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Doküman odak kartı */}
          <div className="p-5 border-b border-workspace-border/30">
            <DocumentFocusCard fileName={fileName} currentTopic={highlightedTopic} />
          </div>

          {/* Toplantı masası — dikey kart listesi, aktif konuşmacı vurgulu */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-text-muted px-2 mb-2 mt-1">
              Katılımcılar · {boardroomAgents.length} kişi
            </h2>
            {boardroomAgents.map((agent) => {
              const sceneState = agentSceneStates[agent.id];
              const isActive = activeSpeakerId === agent.id;
              const isChief = agent.id === "chief-agent";
              const status = sceneState?.status ?? "waiting";
              const inDisagreement =
                disagreementPair &&
                (agent.id === disagreementPair.fromId ||
                  agent.id === disagreementPair.toId);
              return (
                <div
                  key={agent.id}
                  data-seat-id={agent.id}
                  className={`rounded-xl border p-3 transition-all ${
                    isActive
                      ? "border-accent-primary/60 bg-accent-primary/[0.06] shadow-glow-blue"
                      : inDisagreement
                        ? "border-accent-danger/40 bg-accent-danger/[0.04]"
                        : "border-workspace-border bg-workspace-surface"
                  }`}
                >
                  <SpotlightFocus
                    active={
                      !disagreementPair ||
                      agent.id === disagreementPair.fromId ||
                      agent.id === disagreementPair.toId
                    }
                  >
                    <BoardroomAgentSeat
                      agent={agent}
                      sceneState={sceneState}
                      isActiveSpeaker={isActive}
                      isChief={isChief}
                    />
                  </SpotlightFocus>
                </div>
              );
            })}
          </div>

          {/* Durum + karar CTA */}
          <div className="p-4 border-t border-workspace-border/30 space-y-3 shrink-0">
            <div
              className="flex items-center gap-2"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {!isComplete ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse shrink-0" />
                  <span className="text-sm text-text-secondary leading-snug">
                    {phaseLabel[boardroomPhase]}
                  </span>
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-accent-success shrink-0"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-sm text-accent-success font-medium">
                    Tartışma tamamlandı
                  </span>
                </>
              )}
            </div>
            {isComplete ? (
              <Link
                href={SITE.paths.verdict}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-accent-primary text-workspace-surface border border-accent-primary hover:bg-accent-secondary transition-all duration-150 shadow-glow-blue"
              >
                <span>Kararı Gör</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-workspace-elevated text-text-muted border border-workspace-border cursor-not-allowed"
              >
                Kararı Hazırla
              </button>
            )}
          </div>
        </aside>

        <DebateTimelinePanel events={debateTimeline} />
      </div>
    </StageLayout>
  );
}
