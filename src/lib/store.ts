import { create } from "zustand";
import {
  ReviewJob,
  ReviewJobStatus,
  UploadedDocument,
  BusinessContext,
  AgentId,
  AgentRuntime,
  AgentState,
  OrchestrationPhase,
  ActivityEvent,
  ChiefRecommendation,
  InputSource,
} from "./types";
import { DEMO_SCENARIOS, getScenario } from "./scenarios";
import type { AnalysisOutput, SummaryOutput } from "./engine";
import type { ParsedDocument } from "./ingestion";
import { getIngestionService } from "./ingestion";
import { cacheDocxBuffer, clearDocxCache } from "./export/docx-cache";

// --- Right Panel Tab ---
export type RightPanelTab =
  | "activity"
  | "findings"
  | "disagreements"
  | "corrections"
  | "summary"
  | "revisions";

// --- localStorage Keys ---
const LS_KEY_SCENARIO = "agentex_scenario";
const LS_KEY_AGENTS = "agentex_agents";
const LS_KEY_CONTEXT = "agentex_context";

function loadFromLS<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToLS(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// --- Store Interface ---

interface WorkspaceStore {
  // Review Job
  job: ReviewJob;

  // UI State
  rightPanelTab: RightPanelTab;
  selectedAgentId: AgentId | null;
  isLeftPanelCollapsed: boolean;
  isRightPanelCollapsed: boolean;

  // Actions — Setup
  setDocument: (doc: UploadedDocument) => void;
  setParsedDocument: (doc: ParsedDocument, source: InputSource) => void;
  ingestUploadedFile: (file: File) => Promise<{ success: boolean; warnings: string[]; error?: string }>;
  setBusinessContext: (ctx: BusinessContext) => void;
  setChiefRecommendation: (rec: ChiefRecommendation) => void;

  // Actions — Agents
  addAgent: (agentId: AgentId) => void;
  removeAgent: (agentId: AgentId) => void;
  selectAgent: (agentId: AgentId | null) => void;

  // Actions — Orchestration
  startAnalysis: () => void;
  setOrchestrationPhase: (phase: OrchestrationPhase) => void;
  setAgentState: (agentId: AgentId, state: AgentState) => void;
  addActivityEvent: (event: ActivityEvent) => void;
  completeAnalysis: (output: AnalysisOutput, summary: SummaryOutput) => void;

  // Actions — UI
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Actions — Scenario & Demo
  loadDemoScenario: (scenarioId?: string) => void;
  switchScenario: (scenarioId: string) => void;
  resetWorkspace: () => void;
}

// --- Initial State ---

function createEmptyJob(): ReviewJob {
  return {
    id: "review-001",
    title: "Yeni Sözleşme İncelemesi",
    status: "setup",
    activeScenarioId: null,
    businessContext: { notes: [] },
    selectedAgents: [],
    canvasNodes: [],
    orchestrationPhase: "idle",
    agentRuntimes: {} as Record<AgentId, AgentRuntime>,
    findings: [],
    correctionRequests: [],
    disagreements: [],
    revisionSuggestions: [],
    activityStream: [],
  };
}

// --- Store ---

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  job: createEmptyJob(),
  rightPanelTab: "activity",
  selectedAgentId: null,
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,

  // Setup
  setDocument: (doc) =>
    set((s) => ({
      job: {
        ...s.job,
        document: doc,
        status: s.job.businessContext.notes.length > 0 ? "ready" : "setup",
      },
    })),

  setParsedDocument: (doc, source) =>
    set((s) => ({
      job: {
        ...s.job,
        parsedDocument: doc,
        inputSource: source,
      },
    })),

  ingestUploadedFile: async (file: File) => {
    const service = getIngestionService();
    const source = {
      type: "upload" as const,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };

    const result = await service.ingest(source, file);

    if (!result.success || !result.document) {
      const error = result.error ?? "Ingestion failed";
      console.error("Document ingestion failed:", error);
      return { success: false, warnings: result.warnings, error };
    }

    const parsed = result.document;

    // Build backward-compatible UploadedDocument
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt";
    const uploadedDoc: UploadedDocument = {
      id: parsed.id,
      name: file.name,
      type: (ext === "pdf" || ext === "docx" ? ext : "txt") as "pdf" | "docx" | "txt",
      size: file.size,
      uploadedAt: parsed.parsedAt,
      pageCount: parsed.pageCount ?? undefined,
      summary: parsed.sections[0]?.content.slice(0, 200),
    };

    const inputSource: InputSource = { type: "upload", fileName: file.name };

    // Cache original DOCX buffer for in-place patching export
    if (ext === "docx") {
      const buffer = await file.arrayBuffer();
      cacheDocxBuffer(buffer, file.name);
    } else {
      clearDocxCache();
    }

    // Reset all analysis state when uploading a new file (prevent stale results)
    set(() => ({
      job: {
        ...createEmptyJob(),
        document: uploadedDoc,
        parsedDocument: parsed,
        inputSource,
        activeScenarioId: null,
        title: `${file.name} İncelemesi`,
        status: "setup" as ReviewJobStatus,
      },
      rightPanelTab: "activity" as RightPanelTab,
      selectedAgentId: null,
    }));

    if (result.warnings.length > 0) {
      console.warn("Ingestion warnings:", result.warnings);
    }

    return { success: true, warnings: result.warnings };
  },

  setBusinessContext: (ctx) =>
    set((s) => {
      saveToLS(LS_KEY_CONTEXT, ctx.notes);
      return {
        job: {
          ...s.job,
          businessContext: ctx,
          status: s.job.document ? "ready" : "setup",
        },
      };
    }),

  setChiefRecommendation: (rec) =>
    set((s) => {
      const merged = Array.from(
        new Set([...s.job.selectedAgents, ...rec.recommendedAgents]),
      );
      saveToLS(LS_KEY_AGENTS, merged);
      return {
        job: {
          ...s.job,
          chiefRecommendation: rec,
          selectedAgents: merged,
        },
      };
    }),

  // Agents
  addAgent: (agentId) =>
    set((s) => {
      if (s.job.selectedAgents.includes(agentId)) return s;
      const updated = [...s.job.selectedAgents, agentId];
      saveToLS(LS_KEY_AGENTS, updated);
      return { job: { ...s.job, selectedAgents: updated } };
    }),

  removeAgent: (agentId) =>
    set((s) => {
      const updated = s.job.selectedAgents.filter((id) => id !== agentId);
      saveToLS(LS_KEY_AGENTS, updated);
      return {
        job: { ...s.job, selectedAgents: updated },
        selectedAgentId:
          s.selectedAgentId === agentId ? null : s.selectedAgentId,
      };
    }),

  selectAgent: (agentId) => set({ selectedAgentId: agentId }),

  // Orchestration
  startAnalysis: () =>
    set((s) => ({
      job: {
        ...s.job,
        status: "running" as ReviewJobStatus,
        orchestrationPhase: "initializing",
        activityStream: [],
        findings: [],
        correctionRequests: [],
        disagreements: [],
        revisionSuggestions: [],
        managerSummary: undefined,
        discussionSummary: undefined,
      },
      rightPanelTab: "activity" as RightPanelTab,
    })),

  setOrchestrationPhase: (phase) =>
    set((s) => ({
      job: { ...s.job, orchestrationPhase: phase },
    })),

  setAgentState: (agentId, state) =>
    set((s) => ({
      job: {
        ...s.job,
        agentRuntimes: {
          ...s.job.agentRuntimes,
          [agentId]: {
            ...(s.job.agentRuntimes[agentId] || {
              agentId,
              progress: 0,
            }),
            agentId,
            state,
          },
        },
      },
    })),

  addActivityEvent: (event) =>
    set((s) => ({
      job: {
        ...s.job,
        activityStream: [...s.job.activityStream, event],
      },
    })),

  /**
   * Called by the orchestration when analysis completes.
   * Receives pre-computed results from the AnalysisEngine — no filtering logic here.
   */
  completeAnalysis: (output: AnalysisOutput, summary: SummaryOutput) =>
    set((s) => ({
      job: {
        ...s.job,
        status: "complete" as ReviewJobStatus,
        orchestrationPhase: "complete",
        findings: output.findings,
        correctionRequests: output.correctionRequests,
        disagreements: output.disagreements,
        revisionSuggestions: output.revisionSuggestions,
        managerSummary: summary.managerSummary,
        discussionSummary: summary.discussionSummary,
      },
      rightPanelTab: "summary" as RightPanelTab,
    })),

  // UI
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  toggleLeftPanel: () =>
    set((s) => ({ isLeftPanelCollapsed: !s.isLeftPanelCollapsed })),
  toggleRightPanel: () =>
    set((s) => ({ isRightPanelCollapsed: !s.isRightPanelCollapsed })),

  // Scenario & Demo

  loadDemoScenario: (scenarioId?: string) => {
    const targetId =
      scenarioId ||
      loadFromLS<string>(LS_KEY_SCENARIO) ||
      DEMO_SCENARIOS[0].id;

    const scenario = getScenario(targetId);
    if (!scenario) return;

    const savedAgents = loadFromLS<AgentId[]>(LS_KEY_AGENTS);
    const savedNotes = loadFromLS<string[]>(LS_KEY_CONTEXT);

    const agents =
      savedAgents && savedAgents.length > 0
        ? savedAgents
        : scenario.chiefRecommendation.recommendedAgents;

    const context =
      savedNotes && savedNotes.length > 0
        ? { ...scenario.businessContext, notes: savedNotes }
        : scenario.businessContext;

    saveToLS(LS_KEY_SCENARIO, targetId);
    saveToLS(LS_KEY_AGENTS, agents);
    saveToLS(LS_KEY_CONTEXT, context.notes);

    // Produce parsed document via ingestion service (fire-and-forget)
    const inputSource: InputSource = { type: "scenario", scenarioId: targetId };
    const service = getIngestionService();
    const ingestionResult = service.ingest({ type: "scenario", scenarioId: targetId });

    set({
      job: {
        ...createEmptyJob(),
        activeScenarioId: targetId,
        title: `${scenario.name} İncelemesi`,
        document: scenario.document,
        inputSource,
        businessContext: context,
        chiefRecommendation: scenario.chiefRecommendation,
        selectedAgents: agents,
        status: "ready",
      },
    });

    // Attach parsed document once ingestion resolves
    ingestionResult.then((result) => {
      if (result.success && result.document) {
        const current = get().job;
        if (current.activeScenarioId === targetId) {
          set((s) => ({
            job: { ...s.job, parsedDocument: result.document },
          }));
        }
      }
    });
  },

  switchScenario: (scenarioId: string) => {
    const scenario = getScenario(scenarioId);
    if (!scenario) return;

    saveToLS(LS_KEY_SCENARIO, scenarioId);
    saveToLS(LS_KEY_AGENTS, scenario.chiefRecommendation.recommendedAgents);
    saveToLS(LS_KEY_CONTEXT, scenario.businessContext.notes);

    const inputSource: InputSource = { type: "scenario", scenarioId };
    const service = getIngestionService();
    const ingestionResult = service.ingest({ type: "scenario", scenarioId });

    // Clear DOCX cache when switching to scenario
    clearDocxCache();

    set({
      job: {
        ...createEmptyJob(),
        activeScenarioId: scenarioId,
        title: `${scenario.name} İncelemesi`,
        document: scenario.document,
        inputSource,
        businessContext: scenario.businessContext,
        chiefRecommendation: scenario.chiefRecommendation,
        selectedAgents: scenario.chiefRecommendation.recommendedAgents,
        status: "ready",
      },
      rightPanelTab: "activity" as RightPanelTab,
      selectedAgentId: null,
    });

    ingestionResult.then((result) => {
      if (result.success && result.document) {
        const current = get().job;
        if (current.activeScenarioId === scenarioId) {
          set((s) => ({
            job: { ...s.job, parsedDocument: result.document },
          }));
        }
      }
    });
  },

  resetWorkspace: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(LS_KEY_SCENARIO);
      localStorage.removeItem(LS_KEY_AGENTS);
      localStorage.removeItem(LS_KEY_CONTEXT);
    }
    clearDocxCache();
    set({
      job: createEmptyJob(),
      rightPanelTab: "activity",
      selectedAgentId: null,
    });
  },
}));
