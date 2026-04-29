// ============================================================
// Stage Agents — Published-only agent projections for the stage flow
// ============================================================
//
// Single source of truth for all stage-facing pages:
//   - Agent Gallery
//   - Board Setup
//   - Boardroom Scene
//   - Verdict Screen
//
// Uses published Control Room data when available, falls back
// to built-in defaults. Draft-only changes do NOT appear here.
// ============================================================

import {
  BOARDROOM_AGENTS,
  CHIEF_AGENT,
  type BoardroomAgent,
} from "./boardroom-agents";
import {
  useControlRoomStore,
  type AgentCVData,
  type AgentProfile,
  type CustomAgent,
} from "./control-room-store";
import type { PublishedStagePrompt } from "./prompt-behavior";

/**
 * Full stage-facing agent data — extends BoardroomAgent with
 * any published customizations from the Control Room.
 */
export interface StageAgent extends BoardroomAgent {
  /** Whether this agent has published custom CV data */
  hasCustomCV: boolean;
  /** Published tone (for orchestrator voice) */
  tone: string;
  /** Published risk focus (for orchestrator phrasing) */
  riskFocus: string;
  /** Published prompt config (null if using defaults) */
  publishedPrompt: PublishedStagePrompt | null;
}

/**
 * Build a PublishedStagePrompt from a profile when the user has
 * explicitly published a Prompt Studio version. Returns null when there
 * is no published prompt; callers fall back to the agent's built-in
 * default block via buildEffectivePrompt.
 */
function buildPublishedPrompt(profile: AgentProfile | undefined): PublishedStagePrompt | null {
  if (!profile?.promptPublished) return null;
  return {
    systemPrompt: profile.promptPublished.systemPrompt,
    rolePrompt: profile.promptPublished.rolePrompt,
    outputRules: profile.promptPublished.outputRules,
    guardrails: profile.promptPublished.guardrails,
    hasCustomPrompt: true,
    promptVersion: profile.promptVersion,
    publishedAt: profile.promptPublishedAt,
  };
}

/**
 * Resolve the prompt block the pipeline should use for an agent:
 * the user's published prompt when present, otherwise the agent's
 * built-in default. The shape stays a PublishedStagePrompt either way
 * so downstream consumers don't need to special-case the path.
 *
 * hasCustomPrompt remains the source-of-truth flag for the UI to show
 * whether the runtime prompt is user-curated or shipped defaults.
 */
function buildEffectivePrompt(
  base: BoardroomAgent,
  profile: AgentProfile | undefined,
): PublishedStagePrompt | null {
  const published = buildPublishedPrompt(profile);
  if (published) return published;
  if (base.defaultPrompt) {
    return {
      systemPrompt: base.defaultPrompt.systemPrompt,
      rolePrompt: base.defaultPrompt.rolePrompt,
      outputRules: base.defaultPrompt.outputRules,
      guardrails: base.defaultPrompt.guardrails,
      hasCustomPrompt: false,
      promptVersion: 0,
      publishedAt: null,
    };
  }
  return null;
}

/**
 * Merge published CV + prompt data onto a base BoardroomAgent.
 * Only uses published data — never draft.
 */
function mergePublished(base: BoardroomAgent, cv: AgentCVData | null, profile: AgentProfile | undefined): StageAgent {
  const publishedPrompt = buildEffectivePrompt(base, profile);

  if (!cv) {
    return {
      ...base,
      hasCustomCV: false,
      tone: "Profesyonel ve net",
      riskFocus: base.characterLine,
      publishedPrompt,
    };
  }
  return {
    ...base,
    name: cv.name || base.name,
    shortName: base.shortName,
    title: cv.title || base.title,
    expertise: cv.expertise
      ? cv.expertise.split(",").map((s) => s.trim()).filter(Boolean)
      : base.expertise,
    characterLine: cv.riskFocus || base.characterLine,
    bio: cv.principles || base.bio,
    thinkingStyle: cv.principles || base.thinkingStyle,
    documentTypes: cv.industryExperience
      ? cv.industryExperience.split(",").map((s) => s.trim()).filter(Boolean)
      : base.documentTypes,
    hasCustomCV: true,
    tone: cv.tone || "Profesyonel ve net",
    riskFocus: cv.riskFocus || base.characterLine,
    publishedPrompt,
  };
}

// --- React hooks for stage pages ---

/**
 * Returns all gallery-selectable agents with published customizations applied.
 * Call this from any stage page that shows the agent list.
 */
export function useStageAgents(): StageAgent[] {
  const profiles = useControlRoomStore((s) => s.profiles);
  const customAgents = useControlRoomStore((s) => s.customAgents);

  // Archived user agents stay out of the selectable roster but keep
  // resolving by id elsewhere (useStageAgent / snapshot).
  const activeCustom = Object.values(customAgents).filter(
    (a) => !a.archivedAt,
  );
  return [...BOARDROOM_AGENTS, ...activeCustom].map((base) => {
    const profile = profiles[base.id];
    const publishedCV = profile?.cvPublished ?? null;
    return mergePublished(base, publishedCV, profile);
  });
}

function resolveBase(
  agentId: string,
  customAgents: Record<string, CustomAgent>,
): BoardroomAgent | null {
  if (agentId === "chief-agent") return CHIEF_AGENT;
  return (
    BOARDROOM_AGENTS.find((a) => a.id === agentId) ??
    customAgents[agentId] ??
    null
  );
}

/**
 * Returns a single stage agent by ID with published customizations.
 */
export function useStageAgent(agentId: string): StageAgent | null {
  const profiles = useControlRoomStore((s) => s.profiles);
  const customAgents = useControlRoomStore((s) => s.customAgents);

  const base = resolveBase(agentId, customAgents);
  if (!base) return null;

  const profile = profiles[agentId];
  const publishedCV = profile?.cvPublished ?? null;
  return mergePublished(base, publishedCV, profile);
}

/**
 * Returns the chief agent with published customizations.
 */
export function useStageChiefAgent(): StageAgent {
  const profiles = useControlRoomStore((s) => s.profiles);
  const profile = profiles["chief-agent"];
  const publishedCV = profile?.cvPublished ?? null;
  return mergePublished(CHIEF_AGENT, publishedCV, profile);
}

/**
 * Returns effective stage agents for a list of agent IDs.
 * Used by Board Setup, Boardroom, and Verdict to resolve selected agents.
 */
export function useSelectedStageAgents(agentIds: string[]): StageAgent[] {
  const profiles = useControlRoomStore((s) => s.profiles);
  const customAgents = useControlRoomStore((s) => s.customAgents);

  return agentIds
    .map((id) => {
      const base = resolveBase(id, customAgents);
      // Chief-agent is always supplied separately; exclude from this
      // list for the board-setup / verdict views that pass selected-
      // only ids (the caller prepends CHIEF manually when needed).
      if (!base || base.id === CHIEF_AGENT.id) return null;
      const profile = profiles[id];
      const publishedCV = profile?.cvPublished ?? null;
      return mergePublished(base, publishedCV, profile);
    })
    .filter((a): a is StageAgent => a !== null);
}

// --- Non-hook helpers for orchestrator (called outside React) ---

/**
 * Get stage agent data directly from the store snapshot.
 * Used by orchestrator functions that run outside React component lifecycle.
 */
export function getStageAgentSnapshot(agentId: string): StageAgent | null {
  const state = useControlRoomStore.getState();
  const base = resolveBase(agentId, state.customAgents);
  if (!base) return null;

  const profile = state.profiles[agentId];
  const publishedCV = profile?.cvPublished ?? null;
  return mergePublished(base, publishedCV, profile);
}

// --- Template helpers ---

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
  emoji: string;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "legal-board",
    name: "Hukuk Kurulu",
    description: "Sözleşme ve hukuki belgelerin sorumluluk, uyumluluk, vergi ve içtihat dayanaklarıyla değerlendirilmesi.",
    agentIds: ["legal-counsel", "case-law-researcher", "tax-advisor"],
    emoji: "⚖️",
  },
  {
    id: "finance-board",
    name: "Finans Kurulu",
    description: "Mali belgelerin maliyet, gelir etkisi ve finansal risk perspektifinden incelenmesi.",
    agentIds: ["finance-director", "tax-advisor", "sales-director"],
    emoji: "📊",
  },
  {
    id: "executive-board",
    name: "Yönetim Kurulu",
    description: "Kapsamlı değerlendirme — hukuki, mali, ticari ve operasyonel tüm açılardan analiz.",
    agentIds: ["legal-counsel", "case-law-researcher", "finance-director", "tax-advisor", "product-director"],
    emoji: "🏛️",
  },
  {
    id: "research-backed-board",
    name: "Dayanaklı Hukuk Kurulu",
    description: "Hukuki değerlendirmeyi içtihat, kurum kararları ve resmi kaynak araştırmasıyla güçlendiren kurul.",
    agentIds: ["legal-counsel", "case-law-researcher", "tax-advisor", "finance-director"],
    emoji: "📚",
  },
  {
    id: "commercial-board",
    name: "Ticari Kurul",
    description: "Anlaşma yapısı, pazar uyumu ve ticari uygulanabilirlik odaklı değerlendirme.",
    agentIds: ["sales-director", "finance-director", "product-director"],
    emoji: "🎯",
  },
];
