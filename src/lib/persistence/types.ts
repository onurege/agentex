import type { AuditAction, AuditTargetType } from "../audit-log";
import type { AgentCVData, AgentPromptData } from "../control-room-store";
import type { BoardroomRunSnapshot } from "../run-history";

// ─── Agent DTOs ───────────────────────────────────────

export interface AgentVersionDTO {
  id: string;
  version: number;
  cvSnapshot: AgentCVData | null;
  systemPrompt: string | null;
  rolePrompt: string | null;
  outputRules: string | null;
  guardrails: string | null;
  publishedAt: string;
}

export interface AgentProfileDTO {
  agentKey: string;
  cvDraft: AgentCVData | null;
  promptDraft: AgentPromptData | null;
  cvLastSaved: string | null;
  promptLastSaved: string | null;
  currentVersion: AgentVersionDTO | null;
}

// ─── Audit DTO ────────────────────────────────────────

export interface AuditEventDTO {
  id: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  actor: string;
  timestamp: string;
}

// ─── Template DTO ─────────────────────────────────────

export interface BoardTemplateDTO {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  agentKeys: string[];
  ownerId: string | null;
}

// ─── Store Interfaces ─────────────────────────────────

export interface RunStore {
  listRuns(
    userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<{ runs: BoardroomRunSnapshot[]; total: number }>;
  getRunById(id: string): Promise<BoardroomRunSnapshot | null>;
  createRun(userId: string, snapshot: BoardroomRunSnapshot): Promise<void>;
  deleteRun(id: string): Promise<void>;
  bulkImport(
    userId: string,
    runs: BoardroomRunSnapshot[],
  ): Promise<{ imported: number; skipped: number }>;
}

export interface AgentStore {
  getProfile(agentKey: string): Promise<AgentProfileDTO | null>;
  listProfiles(): Promise<AgentProfileDTO[]>;
  saveCVDraft(agentKey: string, cv: AgentCVData): Promise<void>;
  publishCV(agentKey: string): Promise<AgentVersionDTO>;
  savePromptDraft(
    agentKey: string,
    prompt: AgentPromptData,
  ): Promise<void>;
  publishPrompt(agentKey: string): Promise<AgentVersionDTO>;
  rollbackPrompt(agentKey: string): Promise<void>;
  getVersionHistory(agentKey: string): Promise<AgentVersionDTO[]>;
}

export interface AuditStore {
  log(
    event: Omit<AuditEventDTO, "id" | "timestamp">,
  ): Promise<void>;
  list(filters?: {
    action?: string;
    targetType?: string;
    actorId?: string;
    limit?: number;
  }): Promise<AuditEventDTO[]>;
  bulkImport(
    events: AuditEventDTO[],
  ): Promise<{ imported: number; skipped: number }>;
}

export interface TemplateStore {
  list(): Promise<BoardTemplateDTO[]>;
  create(
    template: Omit<BoardTemplateDTO, "id">,
  ): Promise<BoardTemplateDTO>;
  delete(id: string): Promise<void>;
}

// ─── Adapter ──────────────────────────────────────────

export interface PersistenceAdapter {
  runs: RunStore;
  agents: AgentStore;
  audit: AuditStore;
  templates: TemplateStore;
}
