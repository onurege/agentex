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

// --- Store ---

interface ControlRoomState {
  profiles: Record<string, AgentProfile>;
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
  getEffectiveAgent: (agentId: string) => { name: string; title: string; expertise: string[]; avatar: string; isSystem: boolean } | null;

  // Profile access
  getProfile: (agentId: string) => AgentProfile;
}

type ControlRoomStore = ControlRoomState & ControlRoomActions;

// --- Default initializers ---

function getBaseAgent(agentId: string): BoardroomAgent | null {
  if (agentId === "chief-agent") return CHIEF_AGENT;
  return BOARDROOM_AGENTS.find((a) => a.id === agentId) ?? null;
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

function ensureProfile(profiles: Record<string, AgentProfile>, agentId: string): AgentProfile {
  if (profiles[agentId]) return profiles[agentId];
  const base = getBaseAgent(agentId);
  if (!base) return createDefaultProfile(CHIEF_AGENT); // fallback
  return createDefaultProfile(base);
}

// --- Store creation ---

export const useControlRoomStore = create<ControlRoomStore>()(
  persist(
    (set, get) => ({
      profiles: {},

      // ── CV ──────────────────────────────────────────────

      getCVDraft: (agentId) => {
        return ensureProfile(get().profiles, agentId).cvDraft;
      },

      getCVPublished: (agentId) => {
        return ensureProfile(get().profiles, agentId).cvPublished;
      },

      saveCVDraft: (agentId, data) => {
        const profile = ensureProfile(get().profiles, agentId);
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
        const profile = ensureProfile(get().profiles, agentId);
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
        return ensureProfile(get().profiles, agentId).promptDraft;
      },

      getPromptPublished: (agentId) => {
        return ensureProfile(get().profiles, agentId).promptPublished;
      },

      savePromptDraft: (agentId, data) => {
        const profile = ensureProfile(get().profiles, agentId);
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
        const profile = ensureProfile(get().profiles, agentId);
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
        const profile = ensureProfile(get().profiles, agentId);
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
        const base = getBaseAgent(agentId);
        if (!base) return null;
        const profile = get().profiles[agentId];
        const cv = profile?.cvPublished ?? profile?.cvDraft;
        if (!cv) {
          return {
            name: base.name,
            title: base.title,
            expertise: base.expertise,
            avatar: base.avatar,
            isSystem: agentId === "chief-agent",
          };
        }
        return {
          name: cv.name || base.name,
          title: cv.title || base.title,
          expertise: cv.expertise ? cv.expertise.split(",").map((s) => s.trim()).filter(Boolean) : base.expertise,
          avatar: base.avatar,
          isSystem: agentId === "chief-agent",
        };
      },

      // ── Profile access ──────────────────────────────────

      getProfile: (agentId) => {
        return ensureProfile(get().profiles, agentId);
      },
    }),
    {
      name: "ai-boardroom-control-room",
      version: 1,
    },
  ),
);
