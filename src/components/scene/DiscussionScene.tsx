"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { AgentId, AgentState } from "@/lib/types";
import { SceneBubble, SceneSeat, EXPERT_SEAT_ORDER } from "@/lib/scene-types";
import { buildSceneEvents } from "@/lib/scene-events";
import { getScenario } from "@/lib/scenarios";
import { AgentSeat } from "./AgentSeat";
import { SpeechBubble } from "./SpeechBubble";
import { Plus } from "lucide-react";

const MAX_VISIBLE_BUBBLES = 2;
const BUBBLE_TTL_MS = 2800;

function buildSeats(selectedAgents: AgentId[]): SceneSeat[] {
  const seats: SceneSeat[] = [{ position: "head", agentId: "chief-agent" }];
  const experts = selectedAgents.filter((id) => id !== "chief-agent");
  EXPERT_SEAT_ORDER.forEach((pos, i) => {
    seats.push({ position: pos, agentId: experts[i] ?? null });
  });
  return seats;
}

export function DiscussionScene() {
  const job = useWorkspaceStore((s) => s.job);
  const { selectedAgents, agentRuntimes, status, document, businessContext } =
    job;

  const [bubbles, setBubbles] = useState<SceneBubble[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addBubble = useCallback((newBubble: SceneBubble) => {
    setBubbles((prev) => {
      // Remove same-agent bubble
      let next = prev.filter((b) => b.agentId !== newBubble.agentId);
      // If at max, remove oldest non-priority bubble
      while (next.length >= MAX_VISIBLE_BUBBLES) {
        const idx = next.findIndex(
          (b) => b.variant !== "synthesis" && b.variant !== "complete"
        );
        if (idx >= 0) next.splice(idx, 1);
        else break;
      }
      return [...next, newBubble];
    });
  }, []);

  const removeBubble = useCallback((id: string) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Start the scene event sequence when status transitions to "running"
  useEffect(() => {
    if (status !== "running") return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setBubbles([]);

    const scenario = job.activeScenarioId ? getScenario(job.activeScenarioId) : undefined;
    const events = buildSceneEvents(selectedAgents, scenario);

    events.forEach((evt) => {
      const showTimer = setTimeout(() => {
        const bubble: SceneBubble = {
          id: `bubble-${evt.agentId}-${evt.delay}`,
          agentId: evt.agentId,
          text: evt.text,
          variant: evt.variant,
          createdAt: Date.now(),
        };
        addBubble(bubble);

        if (evt.variant !== "synthesis" && evt.variant !== "complete") {
          const removeTimer = setTimeout(
            () => removeBubble(bubble.id),
            BUBBLE_TTL_MS
          );
          timersRef.current.push(removeTimer);
        }
      }, evt.delay);

      timersRef.current.push(showTimer);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // On completion, retain only synthesis / complete bubbles
  useEffect(() => {
    if (status === "complete") {
      setBubbles((prev) =>
        prev.filter(
          (b) => b.variant === "synthesis" || b.variant === "complete"
        )
      );
    }
  }, [status]);

  const seats = buildSeats(selectedAgents);

  const chiefSeat = seats[0];
  const leftSeats = [seats[1], seats[3], seats[5]].filter(
    Boolean
  ) as SceneSeat[];
  const rightSeats = [seats[2], seats[4], seats[6]].filter(
    Boolean
  ) as SceneSeat[];

  const isRunning = status === "running";
  const isComplete = status === "complete";
  const expertCount = selectedAgents.filter(
    (id) => id !== "chief-agent"
  ).length;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 45%, rgba(59,130,246,0.03) 0%, transparent 70%)",
        }}
      />

      {/* ── Status banner ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-workspace-surface/90 border border-workspace-border rounded-lg backdrop-blur-sm shadow-soft">
          {isRunning && (
            <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse flex-shrink-0" />
          )}
          {isComplete && (
            <span className="w-2 h-2 rounded-full bg-accent-success flex-shrink-0" />
          )}
          <span className="text-2xs font-mono text-text-tertiary uppercase tracking-widest">
            {isRunning
              ? "CANLI · Sözleşme İnceleme Toplantısı"
              : isComplete
              ? "TAMAMLANDI · Sözleşme İnceleme Toplantısı"
              : "Sözleşme İnceleme Odası"}
          </span>
        </div>
      </div>

      {/* ── Scene body ── */}
      <div className="relative w-full max-w-[920px] px-6 z-10">
        {/* Chief Agent — head of table */}
        <div className="flex justify-center mb-6">
          <ChiefSlot
            seat={chiefSeat}
            agentRuntimes={agentRuntimes}
            bubbles={bubbles}
          />
        </div>

        {/* Table area with flanking agents */}
        <div className="flex items-center justify-center gap-4 lg:gap-8">
          {/* Left column */}
          <div className="flex flex-col items-end gap-5 min-w-[110px]">
            {leftSeats.map((seat) => (
              <ExpertSlot
                key={seat.position}
                seat={seat}
                agentRuntimes={agentRuntimes}
                bubbles={bubbles}
                side="left"
              />
            ))}
          </div>

          {/* Oval conference table */}
          <ConferenceTable
            document={document}
            businessContext={businessContext}
          />

          {/* Right column */}
          <div className="flex flex-col items-start gap-5 min-w-[110px]">
            {rightSeats.map((seat) => (
              <ExpertSlot
                key={seat.position}
                seat={seat}
                agentRuntimes={agentRuntimes}
                bubbles={bubbles}
                side="right"
              />
            ))}
          </div>
        </div>

        {/* Empty state hint */}
        {expertCount === 0 && !isRunning && !isComplete && (
          <p className="text-center text-xs text-text-muted mt-8 font-mono">
            Sol panelden uzman ajan ekleyin, ardından analizi başlatın
          </p>
        )}
      </div>
    </div>
  );
}

// ── Conference table ────────────────────────────────────────────

interface ConferenceTableProps {
  document?: { name: string; pageCount?: number } | null;
  businessContext: { notes: string[] };
}

function ConferenceTable({
  document: doc,
  businessContext,
}: ConferenceTableProps) {
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: "380px", height: "180px" }}
    >
      <div
        className="absolute inset-0 rounded-[50%] overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(28,32,41,0.95) 0%, rgba(22,26,34,0.95) 100%)",
          border: "1px solid rgba(42,47,58,0.8)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Surface reflection */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 50% 30%, rgba(59,130,246,0.04) 0%, transparent 100%)",
          }}
        />

        {/* Top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-workspace-border/50 to-transparent" />

        {/* Items on table */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-12">
          {doc ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-workspace-bg/40 rounded-lg border border-workspace-border/40">
              <span className="text-sm">📄</span>
              <div>
                <p className="text-xs font-mono text-text-secondary truncate max-w-[180px] leading-tight">
                  {doc.name}
                </p>
                {doc.pageCount && (
                  <p className="text-2xs font-mono text-text-muted leading-none mt-0.5">
                    {doc.pageCount} sayfa
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 opacity-30">
              <span className="text-sm opacity-40">📄</span>
              <span className="text-xs font-mono text-text-muted">
                Belge bekleniyor
              </span>
            </div>
          )}

          {businessContext.notes.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-workspace-bg/30 rounded-lg border border-workspace-border/30">
              <span className="text-xs">📋</span>
              <p className="text-2xs font-mono text-text-muted">
                {businessContext.notes.length} iş notu
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chief Agent slot ────────────────────────────────────────────

interface SlotProps {
  seat: SceneSeat;
  agentRuntimes: Record<
    AgentId,
    { state: AgentState; progress: number; agentId: AgentId }
  >;
  bubbles: SceneBubble[];
  side?: "left" | "right";
}

function ChiefSlot({ seat, agentRuntimes, bubbles }: SlotProps) {
  const { agentId } = seat;
  if (!agentId) return null;

  const agent = AGENTS[agentId];
  const runtime = agentRuntimes[agentId];
  const activeBubble = bubbles.find((b) => b.agentId === agentId);

  return (
    <div className="relative flex flex-col items-center">
      {/* Bubble — appears above the chief */}
      {activeBubble && (
        <div
          className="absolute z-30 w-[300px]"
          style={{
            bottom: "calc(100% + 14px)",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <SpeechBubble
            bubble={activeBubble}
            agentName={agent?.shortName ?? "Baş"}
            side="center"
          />
        </div>
      )}

      <AgentSeat
        agent={agent!}
        runtime={runtime}
        isChief
        hasActiveBubble={!!activeBubble}
        bubbleVariant={activeBubble?.variant}
      />
    </div>
  );
}

// ── Expert agent slot ───────────────────────────────────────────

function ExpertSlot({
  seat,
  agentRuntimes,
  bubbles,
  side,
}: SlotProps & { side: "left" | "right" }) {
  const { agentId } = seat;

  if (!agentId) {
    // Empty seat placeholder
    return (
      <div className="flex flex-col items-center">
        <div className="w-14 h-14 rounded-full border border-dashed border-workspace-border/30 flex items-center justify-center transition-all duration-300">
          <Plus size={16} className="text-text-muted/20" />
        </div>
      </div>
    );
  }

  const agent = AGENTS[agentId];
  const runtime = agentRuntimes[agentId];
  const activeBubble = bubbles.find((b) => b.agentId === agentId);

  return (
    <div className="relative flex flex-col items-center seat-appear">
      {/* Bubble — appears above the agent */}
      {activeBubble && (
        <div
          className="absolute z-30 w-[240px]"
          style={{
            bottom: "calc(100% + 12px)",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <SpeechBubble
            bubble={activeBubble}
            agentName={agent?.shortName ?? "Ajan"}
            side={side}
          />
        </div>
      )}

      <AgentSeat
        agent={agent!}
        runtime={runtime}
        hasActiveBubble={!!activeBubble}
        bubbleVariant={activeBubble?.variant}
      />
    </div>
  );
}
