// ============================================================
// Control Room Store
// ============================================================
//
// Manages panel data: agent CV edits, prompt drafts/published,
// version metadata. Persisted to localStorage so edits survive
// navigation and refresh.
//
// Completely separate from boardroom-flow-store and legacy stores.
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BOARDROOM_AGENTS, type BoardroomAgent } from "./boardroom-agents";
import { CHIEF_AGENT } from "./boardroom-flow-store";
import { saveAuditEvent } from "./audit-log";
import { dispatchToAdapter } from "./persistence/dispatch";
import {
  getPersistenceAdapter,
  getPersistenceMode,
} from "./persistence/factory";
import type { AgentProfileDTO } from "./persistence/types";

// --- CV Data ---

export interface AgentCVData {
  name: string;
  title: string;
  seniority: string;
  expertise: string;
  industryExperience: string;
  riskFocus: string;
  principles: string;
  tone: string;
}

// --- Prompt Data ---

export interface AgentPromptData {
  systemPrompt: string;
  rolePrompt: string;
  outputRules: string;
  guardrails: string;
}

// --- Agent Profile (CV + Prompt together) ---

export interface AgentProfile {
  cvDraft: AgentCVData;
  cvPublished: AgentCVData | null;
  cvLastSaved: string | null;
  cvPublishedAt: string | null;

  promptDraft: AgentPromptData;
  promptPublished: AgentPromptData | null;
  promptLastSaved: string | null;
  promptPublishedAt: string | null;
  promptVersion: number;
}

// --- Custom agent (user-created) ---
//
// Lives alongside BOARDROOM_AGENTS + CHIEF_AGENT. Persisted in the
// same zustand store/localStorage slot as profiles. Soft-delete via
// archivedAt — archived agents are hidden from default listings but
// kept in storage so run-history snapshots still resolve by id.

export interface CustomAgent extends BoardroomAgent {
  isCustom: true;
  archivedAt: string | null;
  createdAt: string;
}

export interface CreateCustomAgentInput {
  id: string;
  name: string;
  title: string;
  avatar: string;
  expertise: string[];
  tone?: string;
}

export type CreateCustomAgentResult =
  | { ok: true; agent: CustomAgent }
  | { ok: false; error: "invalid_id" | "id_taken" | "missing_fields" };

// --- Store ---

interface ControlRoomState {
  profiles: Record<string, AgentProfile>;
  customAgents: Record<string, CustomAgent>;
}

interface ControlRoomActions {
  // CV
  getCVDraft: (agentId: string) => AgentCVData;
  getCVPublished: (agentId: string) => AgentCVData | null;
  saveCVDraft: (agentId: string, data: AgentCVData) => void;
  publishCV: (agentId: string) => void;

  // Prompt
  getPromptDraft: (agentId: string) => AgentPromptData;
  getPromptPublished: (agentId: string) => AgentPromptData | null;
  savePromptDraft: (agentId: string, data: AgentPromptData) => void;
  publishPrompt: (agentId: string) => void;
  rollbackPrompt: (agentId: string) => void;

  // Agent effective data
  getEffectiveAgent: (agentId: string) => { name: string; title: string; expertise: string[]; avatar: string; isSystem: boolean; isCustom: boolean } | null;

  // Profile access
  getProfile: (agentId: string) => AgentProfile;

  // Custom agents
  createCustomAgent: (
    input: CreateCustomAgentInput,
  ) => Promise<CreateCustomAgentResult>;
  archiveCustomAgent: (agentId: string) => void;
  restoreCustomAgent: (agentId: string) => void;
  getCustomAgent: (agentId: string) => CustomAgent | null;
  getAllAgentIds: (opts?: { includeArchived?: boolean }) => string[];
  getAllBoardroomAgents: (opts?: { includeArchived?: boolean }) => BoardroomAgent[];
  hydrateCustomAgentsFromDTOs: (dtos: AgentProfileDTO[]) => void;
}

type ControlRoomStore = ControlRoomState & ControlRoomActions;

// --- Default initializers ---

// Resolves an agent id to its BoardroomAgent definition. Checks
// custom agents first so that a user-created agent with the same id
// as a future built-in wouldn't be shadowed — but id collision is
// already blocked at create-time by isAgentIdTaken.
function getBaseAgent(
  agentId: string,
  customAgents: Record<string, CustomAgent>,
): BoardroomAgent | null {
  const custom = customAgents[agentId];
  if (custom) return custom;
  if (agentId === "chief-agent") return CHIEF_AGENT;
  return BOARDROOM_AGENTS.find((a) => a.id === agentId) ?? null;
}

// Built-in agent ids that a custom agent must not reuse.
const RESERVED_IDS = new Set<string>([
  "chief-agent",
  ...BOARDROOM_AGENTS.map((a) => a.id),
]);

const VALID_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isAgentIdTaken(
  id: string,
  customAgents: Record<string, CustomAgent>,
): boolean {
  if (RESERVED_IDS.has(id)) return true;
  return Boolean(customAgents[id]);
}

// Shape a CustomAgent from an AgentProfileDTO returned by the server
// (or a mirrored local-adapter DTO). Fallbacks cover the case where
// the DTO carries nulls for optional identity fields — e.g. a future
// migration backfill.
function customAgentFromDTO(
  dto: AgentProfileDTO,
  args: {
    shortName: string;
    fallbackName: string;
    fallbackTitle: string;
    fallbackAvatar: string;
    fallbackTone: string;
    preserveCreatedAt?: string;
  },
): CustomAgent {
  return {
    id: dto.agentKey,
    name: dto.displayName ?? args.fallbackName,
    shortName: args.shortName,
    title: dto.title ?? args.fallbackTitle,
    avatar: dto.avatar ?? args.fallbackAvatar,
    color: "agent-custom",
    characterLine: "",
    description: "",
    expertise: dto.expertise.length ? dto.expertise : [],
    bio: "",
    documentTypes: [],
    thinkingStyle: dto.tone ?? args.fallbackTone,
    isCustom: true,
    archivedAt: dto.archivedAt,
    createdAt: args.preserveCreatedAt ?? new Date().toISOString(),
  };
}

function defaultCV(agent: BoardroomAgent): AgentCVData {
  return {
    name: agent.name,
    title: agent.title,
    seniority: "Kıdemli",
    expertise: agent.expertise.join(", "),
    industryExperience: agent.documentTypes.join(", "),
    riskFocus: agent.characterLine,
    principles: agent.thinkingStyle,
    tone: "Profesyonel ve net",
  };
}

function defaultPrompt(agent: BoardroomAgent): AgentPromptData {
  return {
    systemPrompt: `Sen ${agent.name} rolünde bir uzman AI ajansın. ${agent.description}`,
    rolePrompt: `Rol: ${agent.title}\nUzmanlık: ${agent.expertise.join(", ")}\nYaklaşım: ${agent.thinkingStyle}`,
    outputRules: "Bulgularını madde madde sun. Her bulgu için bölüm referansı ver. Kritik riskleri öncelikle belirt.",
    guardrails: "Spekülatif yorum yapma. Belge dışı bilgi kullanma. Kesin hükümler vermek yerine risk değerlendirmesi sun.",
  };
}

function createDefaultProfile(agent: BoardroomAgent): AgentProfile {
  return {
    cvDraft: defaultCV(agent),
    cvPublished: null,
    cvLastSaved: null,
    cvPublishedAt: null,
    promptDraft: defaultPrompt(agent),
    promptPublished: null,
    promptLastSaved: null,
    promptPublishedAt: null,
    promptVersion: 0,
  };
}

function ensureProfile(
  profiles: Record<string, AgentProfile>,
  customAgents: Record<string, CustomAgent>,
  agentId: string,
): AgentProfile {
  if (profiles[agentId]) return profiles[agentId];
  const base = getBaseAgent(agentId, customAgents);
  if (!base) return createDefaultProfile(CHIEF_AGENT); // fallback
  return createDefaultProfile(base);
}

// --- Store creation ---

export const useControlRoomStore = create<ControlRoomStore>()(
  persist(
    (set, get) => ({
      profiles: {},
      customAgents: {},

      // ── CV ──────────────────────────────────────────────

      getCVDraft: (agentId) => {
        return ensureProfile(get().profiles, get().customAgents, agentId).cvDraft;
      },

      getCVPublished: (agentId) => {
        return ensureProfile(get().profiles, get().customAgents, agentId).cvPublished;
      },

      saveCVDraft: (agentId, data) => {
        const profile = ensureProfile(get().profiles, get().customAgents, agentId);
        set({
          profiles: {
            ...get().profiles,
            [agentId]: {
              ...profile,
              cvDraft: data,
              cvLastSaved: new Date().toISOString(),
            },
          },
        });
        saveAuditEvent({ action: "cv_draft_saved", targetType: "agent", targetId: agentId, summary: `${data.name} CV taslağı kaydedildi` });
        dispatchToAdapter((adapter) => adapter.agents.saveCVDraft(agentId, data));
      },

      publishCV: (agentId) => {
        const profile = ensureProfile(get().profiles, get().customAgents, agentId);
        set({
          profiles: {
            ...get().profiles,
            [agentId]: {
              ...profile,
              cvPublished: { ...profile.cvDraft },
              cvPublishedAt: new Date().toISOString(),
            },
          },
        });
        saveAuditEvent({ action: "cv_published", targetType: "agent", targetId: agentId, summary: `${profile.cvDraft.name} CV yayınlandı` });
        dispatchToAdapter((adapter) => adapter.agents.publishCV(agentId));
      },

      // ── Prompt ──────────────────────────────────────────

      getPromptDraft: (agentId) => {
        return ensureProfile(get().profiles, get().customAgents, agentId).promptDraft;
      },

      getPromptPublished: (agentId) => {
        return ensureProfile(get().profiles, get().customAgents, agentId).promptPublished;
      },

      savePromptDraft: (agentId, data) => {
        const profile = ensureProfile(get().profiles, get().customAgents, agentId);
        set({
          profiles: {
            ...get().profiles,
            [agentId]: {
              ...profile,
              promptDraft: data,
              promptLastSaved: new Date().toISOString(),
            },
          },
        });
        saveAuditEvent({ action: "prompt_draft_saved", targetType: "agent", targetId: agentId, summary: `${agentId} prompt taslağı kaydedildi` });
        dispatchToAdapter((adapter) => adapter.agents.savePromptDraft(agentId, data));
      },

      publishPrompt: (agentId) => {
        const profile = ensureProfile(get().profiles, get().customAgents, agentId);
        const newVersion = profile.promptVersion + 1;
        set({
          profiles: {
            ...get().profiles,
            [agentId]: {
              ...profile,
              promptPublished: { ...profile.promptDraft },
              promptPublishedAt: new Date().toISOString(),
              promptVersion: newVersion,
            },
          },
        });
        saveAuditEvent({ action: "prompt_published", targetType: "agent", targetId: agentId, summary: `${agentId} prompt v${newVersion} yayınlandı` });
        dispatchToAdapter((adapter) => adapter.agents.publishPrompt(agentId));
      },

      rollbackPrompt: (agentId) => {
        const profile = ensureProfile(get().profiles, get().customAgents, agentId);
        if (!profile.promptPublished) return;
        set({
          profiles: {
            ...get().profiles,
            [agentId]: {
              ...profile,
              promptDraft: { ...profile.promptPublished },
              promptLastSaved: new Date().toISOString(),
            },
          },
        });
        saveAuditEvent({ action: "prompt_rollback", targetType: "agent", targetId: agentId, summary: `${agentId} prompt v${profile.promptVersion}'e geri alındı` });
        dispatchToAdapter((adapter) => adapter.agents.rollbackPrompt(agentId));
      },

      // ── Effective agent data ────────────────────────────

      getEffectiveAgent: (agentId) => {
        const customAgents = get().customAgents;
        const base = getBaseAgent(agentId, customAgents);
        if (!base) return null;
        const profile = get().profiles[agentId];
        const cv = profile?.cvPublished ?? profile?.cvDraft;
        const isCustom = Boolean(customAgents[agentId]);
        if (!cv) {
          return {
            name: base.name,
            title: base.title,
            expertise: base.expertise,
            avatar: base.avatar,
            isSystem: agentId === "chief-agent",
            isCustom,
          };
        }
        return {
          name: cv.name || base.name,
          title: cv.title || base.title,
          expertise: cv.expertise ? cv.expertise.split(",").map((s) => s.trim()).filter(Boolean) : base.expertise,
          avatar: base.avatar,
          isSystem: agentId === "chief-agent",
          isCustom,
        };
      },

      // ── Profile access ──────────────────────────────────

      getProfile: (agentId) => {
        return ensureProfile(get().profiles, get().customAgents, agentId);
      },

      // ── Custom agents ───────────────────────────────────

      createCustomAgent: async (input) => {
        const id = input.id.trim();
        const name = input.name.trim();
        const title = input.title.trim();
        const avatar = input.avatar.trim();
        const expertise = input.expertise.map((s) => s.trim()).filter(Boolean);

        if (!name || !title || !avatar || expertise.length === 0) {
          return { ok: false, error: "missing_fields" };
        }
        if (!VALID_ID_RE.test(id)) {
          return { ok: false, error: "invalid_id" };
        }
        if (isAgentIdTaken(id, get().customAgents)) {
          return { ok: false, error: "id_taken" };
        }

        const tone = input.tone?.trim() || "Profesyonel ve net";
        const shortName = name.split(/\s+/)[0] || name;

        // DB mode: server is the source of truth — validate there too
        // and wait for the row before updating local state so the
        // redirect-to-cv page can immediately find the agent.
        if (getPersistenceMode() === "db") {
          try {
            const adapter = await getPersistenceAdapter();
            const dto = await adapter.agents.createCustom({
              agentKey: id,
              displayName: name,
              title,
              avatar,
              expertise,
              tone: input.tone?.trim() || null,
            });
            const agent = customAgentFromDTO(dto, {
              shortName,
              fallbackName: name,
              fallbackTitle: title,
              fallbackAvatar: avatar,
              fallbackTone: tone,
            });
            set({ customAgents: { ...get().customAgents, [id]: agent } });
            return { ok: true, agent };
          } catch (err) {
            const code = err instanceof Error ? err.message : "";
            if (code.includes("id_taken")) return { ok: false, error: "id_taken" };
            if (code.includes("invalid_id")) return { ok: false, error: "invalid_id" };
            if (code.includes("missing_fields")) return { ok: false, error: "missing_fields" };
            // eslint-disable-next-line no-console
            console.error("[agents] createCustom failed:", err);
            return { ok: false, error: "missing_fields" };
          }
        }

        // Local mode — no server call; zustand + localStorage stand alone.
        const agent: CustomAgent = {
          id,
          name,
          shortName,
          title,
          avatar,
          color: "agent-custom",
          characterLine: "",
          description: "",
          expertise,
          bio: "",
          documentTypes: [],
          thinkingStyle: tone,
          isCustom: true,
          archivedAt: null,
          createdAt: new Date().toISOString(),
        };
        set({ customAgents: { ...get().customAgents, [id]: agent } });
        saveAuditEvent({
          action: "agent_created",
          targetType: "agent",
          targetId: id,
          summary: `Özel ajan "${name}" oluşturuldu`,
        });
        return { ok: true, agent };
      },

      archiveCustomAgent: (agentId) => {
        const agent = get().customAgents[agentId];
        if (!agent || agent.archivedAt) return;
        set({
          customAgents: {
            ...get().customAgents,
            [agentId]: { ...agent, archivedAt: new Date().toISOString() },
          },
        });
        saveAuditEvent({
          action: "agent_archived",
          targetType: "agent",
          targetId: agentId,
          summary: `Özel ajan "${agent.name}" arşivlendi`,
        });
        dispatchToAdapter((adapter) => adapter.agents.archiveCustom(agentId));
      },

      restoreCustomAgent: (agentId) => {
        const agent = get().customAgents[agentId];
        if (!agent || !agent.archivedAt) return;
        set({
          customAgents: {
            ...get().customAgents,
            [agentId]: { ...agent, archivedAt: null },
          },
        });
        saveAuditEvent({
          action: "agent_restored",
          targetType: "agent",
          targetId: agentId,
          summary: `Özel ajan "${agent.name}" arşivden çıkarıldı`,
        });
        dispatchToAdapter((adapter) => adapter.agents.restoreCustom(agentId));
      },

      hydrateCustomAgentsFromDTOs: (dtos) => {
        const existing = get().customAgents;
        const merged: Record<string, CustomAgent> = { ...existing };
        for (const dto of dtos) {
          if (!dto.isUserCreated) continue;
          const fallbackName = dto.displayName ?? dto.agentKey;
          merged[dto.agentKey] = customAgentFromDTO(dto, {
            shortName: fallbackName.split(/\s+/)[0],
            fallbackName,
            fallbackTitle: dto.title ?? "",
            fallbackAvatar: dto.avatar ?? "🤖",
            fallbackTone: dto.tone ?? "Profesyonel ve net",
            // Keep original createdAt so the same agent doesn't drift
            // when re-hydrated on each page load.
            preserveCreatedAt: existing[dto.agentKey]?.createdAt,
          });
        }
        set({ customAgents: merged });
      },

      getCustomAgent: (agentId) => {
        return get().customAgents[agentId] ?? null;
      },

      getAllAgentIds: (opts) => {
        const includeArchived = opts?.includeArchived ?? false;
        const builtIn = ["chief-agent", ...BOARDROOM_AGENTS.map((a) => a.id)];
        const custom = Object.values(get().customAgents)
          .filter((a) => includeArchived || !a.archivedAt)
          .map((a) => a.id);
        return [...builtIn, ...custom];
      },

      getAllBoardroomAgents: (opts) => {
        const includeArchived = opts?.includeArchived ?? false;
        const custom = Object.values(get().customAgents).filter(
          (a) => includeArchived || !a.archivedAt,
        );
        return [...BOARDROOM_AGENTS, ...custom];
      },
    }),
    {
      name: "ai-boardroom-control-room",
      version: 2,
      migrate: (persistedState: unknown, fromVersion) => {
        // v1 → v2: customAgents slot was introduced. Old payloads
        // don't carry it, so we backfill an empty record.
        if (fromVersion < 2 && persistedState && typeof persistedState === "object") {
          const state = persistedState as Record<string, unknown>;
          if (!state.customAgents) state.customAgents = {};
          return state;
        }
        return persistedState;
      },
    },
  ),
);

// ── Non-hook helpers (for modules that can't use hooks) ──
//
// Boardroom flow store and stage-agents.ts live outside React
// components. They can't call useControlRoomStore directly, so
// these selectors read the current store state synchronously.

export function getCustomAgentsSnapshot(): Record<string, CustomAgent> {
  return useControlRoomStore.getState().customAgents;
}

export function resolveAgentFromAnywhere(agentId: string): BoardroomAgent | null {
  const customAgents = useControlRoomStore.getState().customAgents;
  return getBaseAgent(agentId, customAgents);
}
