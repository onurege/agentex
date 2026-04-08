import { AgentId, AgentState, OrchestrationPhase } from "./types";
import { createAnalysisEngine, extractSeedData } from "./engine";
import type { AnalysisSeedData } from "./engine";
import { getScenario } from "./scenarios";
import { useWorkspaceStore } from "./store";
import type { ParsedDocument } from "./ingestion/types";

// ============================================================
// Orchestration Driver — visual timeline for the analysis UI
// ============================================================
//
// This module drives the ~6.5s visual orchestration timeline.
// It uses the AnalysisEngine for:
//   - Activity events (buildActivityTimeline)
//   - Final results (analyze + summarize) at completion
//
// The orchestration creates the engine via seed data extracted
// from the scenario. It passes ParsedDocument from the store
// to all engine methods as normalized input.
//
// A future real AI integration would replace timers with
// actual agent progress events from the engine.
// ============================================================

interface OrchestrationStep {
  delay: number;
  phase?: OrchestrationPhase;
  agentStates?: Partial<Record<AgentId, AgentState>>;
  eventIndex?: number;
}

/**
 * Build a minimal ParsedDocument fallback from store data.
 * Used when parsedDocument hasn't been populated yet.
 */
function buildFallbackParsedDocument(
  job: { document?: { id: string; name: string; type: string; size: number; pageCount?: number; summary?: string }; activeScenarioId: string | null },
): ParsedDocument {
  const doc = job.document;
  return {
    id: doc?.id ?? "fallback",
    source: job.activeScenarioId
      ? { type: "scenario", scenarioId: job.activeScenarioId }
      : { type: "upload", fileName: doc?.name ?? "unknown", fileType: doc?.type ?? "txt", fileSize: doc?.size ?? 0 },
    fileName: doc?.name ?? "unknown",
    fileType: (doc?.type as "pdf" | "docx" | "txt") ?? "txt",
    fileSize: doc?.size ?? 0,
    pageCount: doc?.pageCount ?? null,
    sections: [],
    fullText: null,
    metadata: { documentTypeGuess: null, language: null, parserUsed: "stub" },
    parsedAt: new Date().toISOString(),
  };
}

export function runOrchestration(): () => void {
  const store = useWorkspaceStore.getState();
  const agents = store.job.selectedAgents;
  const scenarioId = store.job.activeScenarioId;

  // Build seed data and context label from scenario (if available)
  let seedData: AnalysisSeedData | null = null;
  let contextLabel = "Sözleşme";

  if (scenarioId) {
    const scenario = getScenario(scenarioId);
    if (!scenario) {
      console.warn("runOrchestration: scenario not found:", scenarioId);
      return () => {};
    }
    seedData = extractSeedData(scenario);
    contextLabel = scenario.shortName;
  }

  if (!seedData) {
    // Upload path: no seed data yet (future LLM engine would handle this)
    seedData = {
      chiefRecommendation: store.job.chiefRecommendation ?? {
        documentType: "Bilinmeyen",
        riskCategories: [],
        recommendedAgents: [],
        rationale: "",
      },
      findings: [],
      correctionRequests: [],
      disagreements: [],
      revisionSuggestions: [],
      contextLabel,
    };
  }

  // Get normalized document from store, with fallback
  const parsedDocument =
    store.job.parsedDocument ?? buildFallbackParsedDocument(store.job);

  // Create engine with injected seed data (engine never accesses scenarios)
  const engine = createAnalysisEngine({ seedData });

  // Build the activity timeline via the engine
  const events = engine.buildActivityTimeline({
    document: parsedDocument,
    selectedAgents: agents,
    contextLabel,
  });

  const experts = agents.filter((id) => id !== "chief-agent");

  // ---- Build dynamic visual steps ----

  const steps: OrchestrationStep[] = [];
  let eventIdx = 0;

  // 0ms — Chief starts analyzing
  steps.push({
    delay: 0,
    phase: "initializing",
    agentStates: { "chief-agent": "analyzing" },
    eventIndex: eventIdx++,
  });

  // 600ms — All selected experts → waiting
  if (experts.length > 0) {
    steps.push({
      delay: 600,
      phase: "reading",
      agentStates: Object.fromEntries(
        experts.map((id) => [id, "waiting" as AgentState]),
      ) as Partial<Record<AgentId, AgentState>>,
    });
  }

  // 800ms+ — Each expert starts reading (staggered 200ms apart)
  experts.forEach((agentId, i) => {
    steps.push({
      delay: 800 + i * 200,
      agentStates: {
        [agentId]: "reading" as AgentState,
      } as Partial<Record<AgentId, AgentState>>,
      eventIndex:
        eventIdx < events.length && events[eventIdx]?.type === "state-change"
          ? eventIdx++
          : undefined,
    });
  });

  // 2000ms — First half → analyzing
  {
    const analyzeStates: Partial<Record<AgentId, AgentState>> = {
      "chief-agent": "waiting",
    };
    const firstHalf = experts.slice(0, Math.ceil(experts.length / 2));
    for (const id of firstHalf) {
      analyzeStates[id] = "analyzing";
    }
    steps.push({ delay: 2000, phase: "analyzing", agentStates: analyzeStates });
  }

  // 2200ms — Second half → analyzing
  {
    const secondHalf = experts.slice(Math.ceil(experts.length / 2));
    if (secondHalf.length > 0) {
      const states: Partial<Record<AgentId, AgentState>> = {};
      for (const id of secondHalf) {
        states[id] = "analyzing";
      }
      steps.push({ delay: 2200, agentStates: states });
    }
  }

  // 2500ms-3500ms — Finding events
  const findingEvents = events.filter((e) => e.type === "finding");
  findingEvents.forEach((fe, i) => {
    steps.push({ delay: 2500 + i * 500, eventIndex: events.indexOf(fe) });
  });

  // 4000ms — Debate phase
  // Disagreements come from the engine's timeline events, not from scenario directly
  const disagreementEvents = events.filter((e) => e.type === "disagreement");
  const activeDisagreements = seedData.disagreements.filter(
    (d) => agents.includes(d.agentAId) && agents.includes(d.agentBId),
  );

  if (activeDisagreements.length > 0) {
    const d1 = activeDisagreements[0];
    steps.push({
      delay: 4000,
      phase: "debating",
      agentStates: {
        [d1.agentAId]: "debating",
        [d1.agentBId]: "debating",
      },
      eventIndex: disagreementEvents[0]
        ? events.indexOf(disagreementEvents[0])
        : undefined,
    });

    if (activeDisagreements.length > 1) {
      const d2 = activeDisagreements[1];
      steps.push({
        delay: 4800,
        agentStates: {
          [d2.agentAId]: "debating",
          [d2.agentBId]: "debating",
        },
        eventIndex: disagreementEvents[1]
          ? events.indexOf(disagreementEvents[1])
          : undefined,
      });
    }
  } else {
    steps.push({ delay: 4000, phase: "debating" });
  }

  // 5500ms — Synthesis
  {
    const synthStates: Partial<Record<AgentId, AgentState>> = {
      "chief-agent": "synthesizing",
    };
    for (const id of experts) {
      synthStates[id] = "done";
    }
    const synthEvent = events.find((e) => e.type === "synthesis");
    steps.push({
      delay: 5500,
      phase: "synthesizing",
      agentStates: synthStates,
      eventIndex: synthEvent ? events.indexOf(synthEvent) : undefined,
    });
  }

  // 6500ms — Complete
  {
    const completeEvent = events.find((e) => e.type === "complete");
    steps.push({
      delay: 6500,
      phase: "complete",
      agentStates: { "chief-agent": "done" },
      eventIndex: completeEvent ? events.indexOf(completeEvent) : undefined,
    });
  }

  // ---- Execute steps ----

  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const step of steps) {
    const timer = setTimeout(() => {
      const {
        setOrchestrationPhase,
        setAgentState,
        addActivityEvent,
      } = useWorkspaceStore.getState();

      if (step.phase) {
        setOrchestrationPhase(step.phase);
      }

      if (step.agentStates) {
        for (const [agentId, state] of Object.entries(step.agentStates)) {
          setAgentState(agentId as AgentId, state);
        }
      }

      if (step.eventIndex !== undefined && events[step.eventIndex]) {
        addActivityEvent({
          ...events[step.eventIndex],
          timestamp: Date.now(),
        });
      }

      // On final step: call engine.analyze() + engine.summarize() → store results
      if (step.phase === "complete") {
        setTimeout(async () => {
          const { job } = useWorkspaceStore.getState();

          // Use ParsedDocument from store for engine calls
          const doc =
            job.parsedDocument ?? buildFallbackParsedDocument(job);

          const analysisOutput = await engine.analyze({
            document: doc,
            businessContext: job.businessContext,
            selectedAgents: job.selectedAgents,
          });

          const summaryOutput = await engine.summarize({
            document: doc,
            findings: analysisOutput.findings,
            disagreements: analysisOutput.disagreements,
            revisionSuggestions: analysisOutput.revisionSuggestions,
            contextLabel,
          });

          useWorkspaceStore.getState().completeAnalysis(
            analysisOutput,
            summaryOutput,
          );
        }, 500);
      }
    }, step.delay);

    timers.push(timer);
  }

  return () => {
    timers.forEach(clearTimeout);
  };
}
