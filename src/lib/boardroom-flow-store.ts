// ============================================================
// Boardroom Flow Store
// ============================================================
//
// Shared Zustand store for the AI Boardroom stage flow:
//   /app (Agent Gallery) → /app/setup → /app/boardroom → /app/verdict
//
// Completely separate from the legacy contract-review store.
// ============================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ParsedDocument } from "./ingestion/types";
import {
  BOARDROOM_AGENTS,
  CHIEF_AGENT,
  MAX_BOARD_SIZE,
  type BoardroomAgent,
} from "./boardroom-agents";
import { useControlRoomStore } from "./control-room-store";
import { getIngestionService } from "./ingestion";

// Re-export CHIEF_AGENT so existing imports from this module keep
// working after the definition moved to boardroom-agents.ts.
export { CHIEF_AGENT };

// --- Upload status ---

export type UploadStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "success"
  | "error";

// --- Boardroom scene types ---

export type BoardroomPhase =
  | "idle"
  | "kurul-toplaniyor"
  | "belge-inceleniyor"
  | "tartisma"
  | "karar-olusturuluyor"
  | "tamamlandi";

export type BoardroomStatus =
  | "idle"
  | "running"
  | "complete";

// Stance the user takes for this run. Required before launch.
export type Stance = "aggressive" | "favor" | "objective" | "winwin";

export type DebateEventType =
  | "arrival"
  | "observation"
  | "analysis"
  | "objection"
  | "disagreement"
  | "defense"
  | "rebuttal-defend"
  | "rebuttal-challenge"
  | "rebuttal-concede"
  | "rebuttal-refine"
  | "synthesis"
  | "verdict";

export interface DebateEvent {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  type: DebateEventType;
  message: string;
  topic: string;
  timestamp: number;
}

export interface AgentSceneState {
  agentId: string;
  status: "waiting" | "seated" | "reading" | "analyzing" | "speaking" | "objecting" | "defending" | "rebutting" | "synthesizing" | "done";
}

export interface VerdictSeed {
  summary: string;
  riskLevel: "high" | "medium" | "low";
  confidenceLevel?: "high" | "medium" | "low";
  decisions: string[];
  actionItems: string[];
  agentPerspectives: Array<{ agentId: string; agentName: string; avatar: string; position: string }>;
  disagreements: Array<{ topic: string; agentA: string; agentB: string; resolution: string }>;
  resolvedDisagreements?: Array<{ topic: string; agentA: string; agentB: string; resolution: string }>;
  unresolvedDisagreements?: Array<{ topic: string; agentA: string; agentB: string; reason: string }>;
  positionChanges?: Array<{ agentId: string; agentName: string; topic: string; previousStance: string; updatedStance: string }>;
}

// --- Chief agent (always present in boardroom) ---

// --- Store interface ---

interface BoardroomFlowState {
  // Agent Gallery
  selectedAgentIds: string[];

  // Board Setup — Document
  uploadedFile: { name: string; size: number; type: string } | null;
  parsedDocument: ParsedDocument | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
  uploadWarnings: string[];

  // Board Setup — Representation
  clientParty: string;
  stance: Stance | null;

  // Board Setup — Context
  contextNotes: string;

  // Boardroom Scene
  boardroomStatus: BoardroomStatus;
  boardroomPhase: BoardroomPhase;
  activeSpeakerId: string | null;
  highlightedTopic: string | null;
  debateTimeline: DebateEvent[];
  agentSceneStates: Record<string, AgentSceneState>;
  verdictSeed: VerdictSeed | null;

  // Run tracking
  currentRunId: string | null;
  isRestoredRun: boolean;

  // Derived
  selectedAgents: BoardroomAgent[];
  canLaunchBoardroom: boolean;
}

interface BoardroomFlowActions {
  // Agent selection
  selectAgent: (id: string) => void;
  deselectAgent: (id: string) => void;
  setSelectedAgentIds: (ids: string[]) => void;

  // Document
  ingestFile: (file: File) => Promise<void>;
  clearDocument: () => void;

  // Representation
  setClientParty: (party: string) => void;
  setStance: (stance: Stance) => void;

  // Context
  setContextNotes: (notes: string) => void;

  // Boardroom
  setBoardroomPhase: (phase: BoardroomPhase) => void;
  setBoardroomStatus: (status: BoardroomStatus) => void;
  setActiveSpeaker: (agentId: string | null) => void;
  setHighlightedTopic: (topic: string | null) => void;
  addDebateEvent: (event: DebateEvent) => void;
  setAgentSceneState: (agentId: string, state: AgentSceneState) => void;
  completeBoardroom: (verdictSeed: VerdictSeed) => void;

  // Run restore
  restoreRun: (params: {
    runId: string;
    selectedAgentIds: string[];
    documentName: string;
    clientParty: string;
    stance: Stance;
    contextNotes: string;
    debateTimeline: DebateEvent[];
    verdictSeed: VerdictSeed;
  }) => void;

  // Reset
  resetFlow: () => void;
}

type BoardroomFlowStore = BoardroomFlowState & BoardroomFlowActions;

// --- Helpers ---

function deriveSelectedAgents(ids: string[]): BoardroomAgent[] {
  // Custom (user-created) agents live in the control-room store.
  // Checking both sources keeps verdict/boardroom snapshots complete
  // when the board mixes built-in and user agents.
  const customAgents = useControlRoomStore.getState().customAgents;
  return ids
    .map(
      (id) =>
        BOARDROOM_AGENTS.find((a) => a.id === id) ?? customAgents[id] ?? null,
    )
    .filter((a): a is BoardroomAgent => a !== null);
}

function deriveCanLaunch(state: {
  selectedAgentIds: string[];
  uploadStatus: UploadStatus;
  parsedDocument: ParsedDocument | null;
  clientParty: string;
  stance: Stance | null;
}): boolean {
  return (
    state.selectedAgentIds.length >= 2 &&
    state.uploadStatus === "success" &&
    state.parsedDocument !== null &&
    state.clientParty.trim().length > 0 &&
    state.stance !== null
  );
}

// --- Initial state ---

const INITIAL_STATE: BoardroomFlowState = {
  selectedAgentIds: [],
  uploadedFile: null,
  parsedDocument: null,
  uploadStatus: "idle",
  uploadError: null,
  uploadWarnings: [],
  clientParty: "",
  stance: null,
  contextNotes: "",
  boardroomStatus: "idle",
  boardroomPhase: "idle",
  activeSpeakerId: null,
  highlightedTopic: null,
  debateTimeline: [],
  agentSceneStates: {},
  verdictSeed: null,
  currentRunId: null,
  isRestoredRun: false,
  selectedAgents: [],
  canLaunchBoardroom: false,
};

// --- Store ---

export const useBoardroomFlowStore = create<BoardroomFlowStore>()(
  persist(
    (set, get) => ({
  ...INITIAL_STATE,

  // ── Agent selection ──────────────────────────────────────

  selectAgent: (id) => {
    const { selectedAgentIds } = get();
    if (selectedAgentIds.includes(id) || selectedAgentIds.length >= MAX_BOARD_SIZE)
      return;
    const next = [...selectedAgentIds, id];
    set({
      selectedAgentIds: next,
      selectedAgents: deriveSelectedAgents(next),
      canLaunchBoardroom: deriveCanLaunch({ ...get(), selectedAgentIds: next }),
    });
  },

  deselectAgent: (id) => {
    const { selectedAgentIds } = get();
    const next = selectedAgentIds.filter((aid) => aid !== id);
    set({
      selectedAgentIds: next,
      selectedAgents: deriveSelectedAgents(next),
      canLaunchBoardroom: deriveCanLaunch({ ...get(), selectedAgentIds: next }),
    });
  },

  setSelectedAgentIds: (ids) => {
    set({
      selectedAgentIds: ids,
      selectedAgents: deriveSelectedAgents(ids),
      canLaunchBoardroom: deriveCanLaunch({ ...get(), selectedAgentIds: ids }),
    });
  },

  // ── Document ingestion ───────────────────────────────────

  ingestFile: async (file: File) => {
    set({
      uploadStatus: "uploading",
      uploadError: null,
      uploadWarnings: [],
      uploadedFile: { name: file.name, size: file.size, type: file.type },
    });

    try {
      set({ uploadStatus: "parsing" });

      const service = getIngestionService();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const source = {
        type: "upload" as const,
        fileName: file.name,
        fileType: file.type || ext,
        fileSize: file.size,
      };

      const result = await service.ingest(source, file);

      if (!result.success || !result.document) {
        set({
          uploadStatus: "error",
          uploadError: result.error ?? "Belge okunamadı",
          uploadWarnings: result.warnings,
        });
        return;
      }

      set((s) => ({
        parsedDocument: result.document!,
        uploadStatus: "success",
        uploadWarnings: result.warnings,
        canLaunchBoardroom: deriveCanLaunch({
          ...s,
          uploadStatus: "success",
          parsedDocument: result.document!,
        }),
      }));
    } catch (err) {
      set({
        uploadStatus: "error",
        uploadError:
          err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu",
      });
    }
  },

  clearDocument: () => {
    set({
      uploadedFile: null,
      parsedDocument: null,
      uploadStatus: "idle",
      uploadError: null,
      uploadWarnings: [],
      canLaunchBoardroom: false,
    });
  },

  // ── Representation ───────────────────────────────────────

  setClientParty: (party) => {
    set((s) => ({
      clientParty: party,
      canLaunchBoardroom: deriveCanLaunch({ ...s, clientParty: party }),
    }));
  },

  setStance: (stance) => {
    set((s) => ({
      stance,
      canLaunchBoardroom: deriveCanLaunch({ ...s, stance }),
    }));
  },

  // ── Context ──────────────────────────────────────────────

  setContextNotes: (notes) => {
    set({ contextNotes: notes });
  },

  // ── Boardroom ────────────────────────────────────────────

  setBoardroomPhase: (phase) => {
    set({ boardroomPhase: phase });
  },

  setBoardroomStatus: (status) => {
    set({ boardroomStatus: status });
  },

  setActiveSpeaker: (agentId) => {
    set({ activeSpeakerId: agentId });
  },

  setHighlightedTopic: (topic) => {
    set({ highlightedTopic: topic });
  },

  addDebateEvent: (event) => {
    set((s) => ({
      debateTimeline: [...s.debateTimeline, event],
    }));
  },

  setAgentSceneState: (agentId, state) => {
    set((s) => ({
      agentSceneStates: { ...s.agentSceneStates, [agentId]: state },
    }));
  },

  completeBoardroom: (verdictSeed) => {
    set({
      boardroomStatus: "complete",
      boardroomPhase: "tamamlandi",
      activeSpeakerId: null,
      verdictSeed,
    });
  },

  // ── Run restore ──────────────────────────────────────────

  restoreRun: (params) => {
    set({
      ...INITIAL_STATE,
      selectedAgentIds: params.selectedAgentIds,
      selectedAgents: deriveSelectedAgents(params.selectedAgentIds),
      uploadedFile: { name: params.documentName, size: 0, type: "" },
      clientParty: params.clientParty,
      stance: params.stance,
      contextNotes: params.contextNotes,
      boardroomStatus: "complete",
      boardroomPhase: "tamamlandi",
      debateTimeline: params.debateTimeline,
      verdictSeed: params.verdictSeed,
      uploadStatus: "success",
      currentRunId: params.runId,
      isRestoredRun: true,
    });
  },

  // ── Reset ────────────────────────────────────────────────

  resetFlow: () => {
    set(INITIAL_STATE);
  },
    }),
    {
      name: "ai-boardroom-flow",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        selectedAgentIds: state.selectedAgentIds,
        uploadedFile: state.uploadedFile,
        parsedDocument: state.parsedDocument,
        clientParty: state.clientParty,
        stance: state.stance,
        contextNotes: state.contextNotes,
        boardroomStatus: state.boardroomStatus,
        boardroomPhase: state.boardroomPhase,
        agentSceneStates: state.agentSceneStates,
        debateTimeline: state.debateTimeline,
        verdictSeed: state.verdictSeed,
        currentRunId: state.currentRunId,
        isRestoredRun: state.isRestoredRun,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.selectedAgents = deriveSelectedAgents(state.selectedAgentIds);
        if (state.parsedDocument) {
          state.uploadStatus = "success";
        }
        state.canLaunchBoardroom = deriveCanLaunch(state);
      },
    },
  ),
);
