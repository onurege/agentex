import {
  getBoardroomRuns,
  getBoardroomRunById,
  saveBoardroomRun,
  deleteBoardroomRun,
  type BoardroomRunSnapshot,
} from "../run-history";
import {
  saveAuditEvent,
  getAuditEvents,
  type AuditAction,
  type AuditTargetType,
} from "../audit-log";
import { useControlRoomStore } from "../control-room-store";
import { BOARD_TEMPLATES } from "../stage-agents";
import type {
  PersistenceAdapter,
  RunStore,
  AgentStore,
  AuditStore,
  TemplateStore,
  AgentProfileDTO,
  AgentVersionDTO,
  AuditEventDTO,
  BoardTemplateDTO,
} from "./types";

// ─── Run Store (localStorage) ─────────────────────────

class LocalRunStore implements RunStore {
  async listRuns(
    _userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<{ runs: BoardroomRunSnapshot[]; total: number }> {
    const all = getBoardroomRuns();
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return {
      runs: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  async getRunById(id: string): Promise<BoardroomRunSnapshot | null> {
    return getBoardroomRunById(id);
  }

  async createRun(
    _userId: string,
    snapshot: BoardroomRunSnapshot,
  ): Promise<void> {
    saveBoardroomRun(snapshot);
  }

  async deleteRun(id: string): Promise<void> {
    deleteBoardroomRun(id);
  }

  async bulkImport(
    _userId: string,
    runs: BoardroomRunSnapshot[],
  ): Promise<{ imported: number; skipped: number }> {
    const existing = getBoardroomRuns();
    const existingIds = new Set(existing.map((r) => r.id));
    let imported = 0;
    let skipped = 0;
    for (const run of runs) {
      if (existingIds.has(run.id)) {
        skipped++;
      } else {
        saveBoardroomRun(run);
        imported++;
      }
    }
    return { imported, skipped };
  }
}

// ─── Agent Store (localStorage via control-room-store) ─

class LocalAgentStore implements AgentStore {
  private get store() {
    return useControlRoomStore.getState();
  }

  // Project custom-agent identity (custom fields) onto a DTO. Built-in
  // agents return nulls for these fields so the shape matches either
  // way.
  private customFields(agentKey: string) {
    const custom = this.store.customAgents[agentKey];
    return {
      displayName: custom?.name ?? null,
      title: custom?.title ?? null,
      avatar: custom?.avatar ?? null,
      expertise: custom?.expertise ?? [],
      tone: custom?.thinkingStyle ?? null,
      isUserCreated: Boolean(custom),
      archivedAt: custom?.archivedAt ?? null,
      // Local mode is single-user; ownerId is meaningful only in DB
      // mode where the schema tracks users.
      ownerId: null as string | null,
    };
  }

  async getProfile(agentKey: string): Promise<AgentProfileDTO | null> {
    const profile = this.store.getProfile(agentKey);
    return {
      agentKey,
      cvDraft: profile.cvDraft,
      promptDraft: profile.promptDraft,
      cvLastSaved: profile.cvLastSaved,
      promptLastSaved: profile.promptLastSaved,
      currentVersion: profile.promptPublished
        ? {
            id: `local-v${profile.promptVersion}`,
            version: profile.promptVersion,
            cvSnapshot: profile.cvPublished,
            systemPrompt: profile.promptPublished.systemPrompt,
            rolePrompt: profile.promptPublished.rolePrompt,
            outputRules: profile.promptPublished.outputRules,
            guardrails: profile.promptPublished.guardrails,
            publishedAt: profile.promptPublishedAt ?? new Date().toISOString(),
          }
        : null,
      ...this.customFields(agentKey),
    };
  }

  async listProfiles(): Promise<AgentProfileDTO[]> {
    const profiles = this.store.profiles;
    return Object.entries(profiles).map(([agentKey, profile]) => ({
      agentKey,
      cvDraft: profile.cvDraft,
      promptDraft: profile.promptDraft,
      cvLastSaved: profile.cvLastSaved,
      promptLastSaved: profile.promptLastSaved,
      currentVersion: profile.promptPublished
        ? {
            id: `local-v${profile.promptVersion}`,
            version: profile.promptVersion,
            cvSnapshot: profile.cvPublished,
            systemPrompt: profile.promptPublished.systemPrompt,
            rolePrompt: profile.promptPublished.rolePrompt,
            outputRules: profile.promptPublished.outputRules,
            guardrails: profile.promptPublished.guardrails,
            publishedAt: profile.promptPublishedAt ?? new Date().toISOString(),
          }
        : null,
      ...this.customFields(agentKey),
    }));
  }

  async saveCVDraft(
    agentKey: string,
    cv: import("../control-room-store").AgentCVData,
  ): Promise<void> {
    this.store.saveCVDraft(agentKey, cv);
  }

  async publishCV(agentKey: string): Promise<AgentVersionDTO> {
    this.store.publishCV(agentKey);
    const profile = this.store.getProfile(agentKey);
    return {
      id: `local-v${profile.promptVersion}`,
      version: profile.promptVersion,
      cvSnapshot: profile.cvPublished,
      systemPrompt: profile.promptPublished?.systemPrompt ?? null,
      rolePrompt: profile.promptPublished?.rolePrompt ?? null,
      outputRules: profile.promptPublished?.outputRules ?? null,
      guardrails: profile.promptPublished?.guardrails ?? null,
      publishedAt: profile.cvPublishedAt ?? new Date().toISOString(),
    };
  }

  async savePromptDraft(
    agentKey: string,
    prompt: import("../control-room-store").AgentPromptData,
  ): Promise<void> {
    this.store.savePromptDraft(agentKey, prompt);
  }

  async publishPrompt(agentKey: string): Promise<AgentVersionDTO> {
    this.store.publishPrompt(agentKey);
    const profile = this.store.getProfile(agentKey);
    return {
      id: `local-v${profile.promptVersion}`,
      version: profile.promptVersion,
      cvSnapshot: profile.cvPublished,
      systemPrompt: profile.promptPublished?.systemPrompt ?? null,
      rolePrompt: profile.promptPublished?.rolePrompt ?? null,
      outputRules: profile.promptPublished?.outputRules ?? null,
      guardrails: profile.promptPublished?.guardrails ?? null,
      publishedAt: profile.promptPublishedAt ?? new Date().toISOString(),
    };
  }

  async rollbackPrompt(agentKey: string): Promise<void> {
    this.store.rollbackPrompt(agentKey);
  }

  async getVersionHistory(_agentKey: string): Promise<AgentVersionDTO[]> {
    return [];
  }

  // ── Custom agents ─────────────────────────────────────

  async createCustom(
    input: import("./types").CreateCustomAgentDTO,
  ): Promise<AgentProfileDTO> {
    const result = this.store.createCustomAgent({
      id: input.agentKey,
      name: input.displayName,
      title: input.title,
      avatar: input.avatar,
      expertise: input.expertise,
      tone: input.tone ?? undefined,
    });
    if (!result.ok) {
      // Surface the tagged error through an Error so the caller can
      // inspect `.message` — the store's typed result stays the
      // source of truth for the validation codes.
      throw new Error(result.error);
    }
    const profile = await this.getProfile(input.agentKey);
    if (!profile) throw new Error("profile_missing_after_create");
    return profile;
  }

  async archiveCustom(agentKey: string): Promise<void> {
    this.store.archiveCustomAgent(agentKey);
  }

  async restoreCustom(agentKey: string): Promise<void> {
    this.store.restoreCustomAgent(agentKey);
  }
}

// ─── Audit Store (localStorage) ───────────────────────

class LocalAuditStore implements AuditStore {
  async log(
    event: Omit<AuditEventDTO, "id" | "timestamp">,
  ): Promise<void> {
    saveAuditEvent({
      action: event.action as AuditAction,
      targetType: event.targetType as AuditTargetType,
      targetId: event.targetId,
      summary: event.summary,
      actor: event.actor,
    });
  }

  async list(filters?: {
    action?: string;
    targetType?: string;
    limit?: number;
  }): Promise<AuditEventDTO[]> {
    const events = getAuditEvents({
      action: filters?.action as AuditAction | undefined,
      targetType: filters?.targetType as AuditTargetType | undefined,
    });
    const limit = filters?.limit ?? 200;
    return events.slice(0, limit);
  }

  async bulkImport(
    events: AuditEventDTO[],
  ): Promise<{ imported: number; skipped: number }> {
    const existing = getAuditEvents();
    const existingIds = new Set(existing.map((e) => e.id));
    let imported = 0;
    let skipped = 0;
    for (const event of events) {
      if (existingIds.has(event.id)) {
        skipped++;
      } else {
        saveAuditEvent({
          action: event.action as AuditAction,
          targetType: event.targetType as AuditTargetType,
          targetId: event.targetId,
          summary: event.summary,
          actor: event.actor,
        });
        imported++;
      }
    }
    return { imported, skipped };
  }
}

// ─── Template Store (static, read-only) ───────────────

class LocalTemplateStore implements TemplateStore {
  async list(): Promise<BoardTemplateDTO[]> {
    return BOARD_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      emoji: t.emoji,
      agentKeys: t.agentIds,
      ownerId: null,
    }));
  }

  async create(
    _template: Omit<BoardTemplateDTO, "id">,
  ): Promise<BoardTemplateDTO> {
    throw new Error("Custom templates not supported in local mode");
  }

  async delete(_id: string): Promise<void> {
    throw new Error("Template deletion not supported in local mode");
  }
}

// ─── Adapter ──────────────────────────────────────────

export class LocalStorageAdapter implements PersistenceAdapter {
  runs = new LocalRunStore();
  agents = new LocalAgentStore();
  audit = new LocalAuditStore();
  templates = new LocalTemplateStore();
}
