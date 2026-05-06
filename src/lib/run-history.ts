// ============================================================
// AI Boardroom Run History
// ============================================================
//
// Persists completed boardroom runs to localStorage.
// Each run contains a frozen snapshot of all data at execution time:
//   - agent identities (frozen, not affected by later CV edits)
//   - document metadata
//   - context notes
//   - debate timeline
//   - verdict seed
//
// Separate from legacy contract-review history.
// ============================================================

import type { DebateEvent, VerdictSeed } from "./boardroom-flow-store";
import { dispatchToAdapter } from "./persistence/dispatch";
import type { ArbitratedEdit, EditProposal } from "./redline/types";

// --- Frozen agent snapshot (does not change with later edits) ---

export interface FrozenPromptSnapshot {
  promptVersion: number;
  publishedAt: string | null;
  systemPrompt: string;
  rolePrompt: string;
  outputRules: string;
  guardrails: string;
}

export interface FrozenAgentSnapshot {
  id: string;
  name: string;
  shortName: string;
  title: string;
  avatar: string;
  expertise: string[];
  characterLine: string;
  thinkingStyle: string;
  tone: string;
  riskFocus: string;
  isChief: boolean;
  /** Frozen prompt config used at run time (null = default prompt) */
  promptSnapshot: FrozenPromptSnapshot | null;
}

// --- Run snapshot ---

export interface BoardroomRunSnapshot {
  id: string;
  createdAt: string;

  // Document
  documentName: string;
  documentType: string;
  documentSize: number;

  // Board
  selectedAgentIds: string[];
  agentSnapshots: FrozenAgentSnapshot[];
  contextNotes: string;

  // Representation context (frozen at run time)
  clientParty: string;
  stance: "aggressive" | "favor" | "objective" | "winwin";

  // Debate
  debateTimeline: DebateEvent[];

  // Verdict
  verdictSeed: VerdictSeed;

  // Analysis metadata
  analysisMode?: "ai" | "ai-partial" | "fallback";
  modelInfo?: string;
  pipelineStages?: Array<{
    stage: string;
    status: string;
    durationMs: number;
    agentId?: string;
    error?: string;
  }>;

  // Faz 4 redline payload — only populated in db-mode flows where we
  // generate a track-changes DOCX. Omitted from local-mode
  // localStorage to keep per-run size bounded (base64 can be ~13MB).
  originalDocxBase64?: string | null;
  editProposals?: EditProposal[];
  arbitratedEdits?: ArbitratedEdit[];
}

/**
 * Server-side list DTO. Carries the snapshot plus ownership + group
 * fields that the listing endpoint resolves from the join. Lets the UI
 * render owner/group badges and filter without a second roundtrip.
 *
 * Not persisted client-side (localStorage stores plain snapshots).
 */
export interface RunListItem extends BoardroomRunSnapshot {
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  groupId: string | null;
  groupName: string | null;
  /** True when the viewer is the run's creator. UI gates edit/delete. */
  isOwn: boolean;
}

// --- localStorage key ---

const LS_KEY = "ai-boardroom-run-history";
const MAX_RUNS = 50;

// --- CRUD ---

function readRuns(): BoardroomRunSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRuns(runs: BoardroomRunSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    // Storage full — silently fail
  }
}

export function saveBoardroomRun(run: BoardroomRunSnapshot): void {
  // localStorage copy drops Faz 4 payload — base64 DOCX + proposal/
  // arbitration arrays can push the snapshot above sessionStorage /
  // localStorage quotas. The full payload still travels to the server
  // via the adapter dispatch below.
  const {
    originalDocxBase64: _docxBase64,
    editProposals: _proposals,
    arbitratedEdits: _edits,
    ...localCopy
  } = run;
  void _docxBase64;
  void _proposals;
  void _edits;

  const runs = readRuns();
  const filtered = runs.filter((r) => r.id !== localCopy.id);
  writeRuns([localCopy, ...filtered]);

  // Audit log (local mode only — db mode writes audit server-side via API)
  try {
    const { saveAuditEvent } = require("./audit-log");
    saveAuditEvent({
      action: "run_created",
      targetType: "run",
      targetId: run.id,
      summary: `"${run.documentName}" kurul tartışması tamamlandı`,
    });
  } catch {
    // Audit log not available (SSR)
  }

  // DB mode: POST /api/runs in background with the full payload so
  // server can persist DocumentArtifact + proposals + redline. Local
  // mode: no-op.
  dispatchToAdapter((adapter) => adapter.runs.createRun("", run));
}

export function getBoardroomRuns(): BoardroomRunSnapshot[] {
  return readRuns();
}

export function getBoardroomRunById(id: string): BoardroomRunSnapshot | null {
  const runs = readRuns();
  return runs.find((r) => r.id === id) ?? null;
}

export function deleteBoardroomRun(id: string): void {
  const runs = readRuns();
  writeRuns(runs.filter((r) => r.id !== id));

  // DB mode: DELETE /api/runs/:id in background. Local mode: no-op.
  dispatchToAdapter((adapter) => adapter.runs.deleteRun(id));
}

// --- Snapshot builder ---

import type { StageAgent } from "./stage-agents";

export function buildFrozenAgentSnapshot(agent: StageAgent, isChief: boolean): FrozenAgentSnapshot {
  const promptSnapshot: FrozenPromptSnapshot | null = agent.publishedPrompt
    ? {
        promptVersion: agent.publishedPrompt.promptVersion,
        publishedAt: agent.publishedPrompt.publishedAt,
        systemPrompt: agent.publishedPrompt.systemPrompt,
        rolePrompt: agent.publishedPrompt.rolePrompt,
        outputRules: agent.publishedPrompt.outputRules,
        guardrails: agent.publishedPrompt.guardrails,
      }
    : null;

  return {
    id: agent.id,
    name: agent.name,
    shortName: agent.shortName,
    title: agent.title,
    avatar: agent.avatar,
    expertise: [...agent.expertise],
    characterLine: agent.characterLine,
    thinkingStyle: agent.thinkingStyle,
    tone: agent.tone ?? "Profesyonel ve net",
    riskFocus: agent.riskFocus ?? agent.characterLine,
    isChief,
    promptSnapshot,
  };
}

export function buildRunSnapshot(params: {
  selectedAgentIds: string[];
  agentSnapshots: FrozenAgentSnapshot[];
  documentName: string;
  documentType: string;
  documentSize: number;
  contextNotes: string;
  clientParty: string;
  stance: BoardroomRunSnapshot["stance"];
  debateTimeline: DebateEvent[];
  verdictSeed: VerdictSeed;
  // Faz 4 — only passed in db mode; omitted keeps legacy snapshot shape.
  originalDocxBase64?: string | null;
  editProposals?: EditProposal[];
  arbitratedEdits?: ArbitratedEdit[];
}): BoardroomRunSnapshot {
  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    documentName: params.documentName,
    documentType: params.documentType,
    documentSize: params.documentSize,
    selectedAgentIds: params.selectedAgentIds,
    agentSnapshots: params.agentSnapshots,
    contextNotes: params.contextNotes,
    clientParty: params.clientParty,
    stance: params.stance,
    debateTimeline: params.debateTimeline,
    verdictSeed: params.verdictSeed,
    originalDocxBase64: params.originalDocxBase64,
    editProposals: params.editProposals,
    arbitratedEdits: params.arbitratedEdits,
  };
}
