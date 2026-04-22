// ============================================================
// Prompt Behavior Layer
// ============================================================
//
// Transforms published prompt data into usable stage behavior.
// Sits between raw panel prompt data and the boardroom orchestrator.
//
// Never reads draft data — only published prompt state.
// ============================================================

import type { AgentPromptData } from "./control-room-store";

// --- Published stage prompt (normalized for consumption) ---

export interface PublishedStagePrompt {
  systemPrompt: string;
  rolePrompt: string;
  outputRules: string;
  guardrails: string;
  hasCustomPrompt: boolean;
  promptVersion: number;
  publishedAt: string | null;
}

// --- Frozen prompt snapshot (for run history) ---

export interface FrozenPromptSnapshot {
  agentId: string;
  promptVersion: number;
  publishedAt: string | null;
  systemPrompt: string;
  rolePrompt: string;
  outputRules: string;
  guardrails: string;
}

// --- Debate style profile (derived from prompt data) ---

export interface DebateStyle {
  /** How assertive objections should be: cautious | balanced | assertive */
  assertiveness: "cautious" | "balanced" | "assertive";
  /** How verbose speech should be: concise | moderate | detailed */
  verbosity: "concise" | "moderate" | "detailed";
  /** Whether the agent is conservative (strict guardrails) */
  conservative: boolean;
  /** Emphasis keywords extracted from role prompt */
  emphasisKeywords: string[];
  /** Speech suffix modifier based on guardrails */
  guardSuffix: string;
}

// --- Behavior derivation ---

/**
 * Build a DebateStyle from published prompt data.
 * This transforms prompt configuration into orchestrator-usable behavior.
 */
export function buildDebateStyle(prompt: PublishedStagePrompt | null): DebateStyle {
  if (!prompt || !prompt.hasCustomPrompt) {
    return {
      assertiveness: "balanced",
      verbosity: "moderate",
      conservative: false,
      emphasisKeywords: [],
      guardSuffix: "",
    };
  }

  // Derive assertiveness from role prompt and system prompt
  const combined = `${prompt.systemPrompt} ${prompt.rolePrompt}`.toLowerCase();
  let assertiveness: DebateStyle["assertiveness"] = "balanced";
  if (combined.includes("doğrudan") || combined.includes("kararlı") || combined.includes("kesin") || combined.includes("assertive")) {
    assertiveness = "assertive";
  } else if (combined.includes("dikkatli") || combined.includes("ihtiyatlı") || combined.includes("temkinli") || combined.includes("cautious")) {
    assertiveness = "cautious";
  }

  // Derive verbosity from output rules
  const outputLower = prompt.outputRules.toLowerCase();
  let verbosity: DebateStyle["verbosity"] = "moderate";
  if (outputLower.includes("kısa") || outputLower.includes("öz") || outputLower.includes("concise") || outputLower.length < 50) {
    verbosity = "concise";
  } else if (outputLower.includes("detaylı") || outputLower.includes("kapsamlı") || outputLower.includes("detailed")) {
    verbosity = "detailed";
  }

  // Derive conservativeness from guardrails
  const guardLower = prompt.guardrails.toLowerCase();
  const conservative = guardLower.includes("spekülatif") || guardLower.includes("kesin hüküm") || guardLower.includes("sınırlı") || guardLower.length > 100;

  // Extract emphasis keywords from role prompt
  const emphasisKeywords = extractEmphasisKeywords(prompt.rolePrompt);

  // Build guard suffix
  let guardSuffix = "";
  if (conservative) {
    guardSuffix = " (dikkatli değerlendirme)";
  }

  return { assertiveness, verbosity, conservative, emphasisKeywords, guardSuffix };
}

function extractEmphasisKeywords(rolePrompt: string): string[] {
  const keywords: string[] = [];
  const lower = rolePrompt.toLowerCase();

  const patterns = [
    { pattern: /risk/i, keyword: "risk" },
    { pattern: /maliyet/i, keyword: "maliyet" },
    { pattern: /sorumluluk/i, keyword: "sorumluluk" },
    { pattern: /uyum/i, keyword: "uyumluluk" },
    { pattern: /performans/i, keyword: "performans" },
    { pattern: /güvenlik/i, keyword: "güvenlik" },
    { pattern: /fiyat/i, keyword: "fiyatlandırma" },
    { pattern: /operasyonel/i, keyword: "operasyonel" },
  ];

  for (const { pattern, keyword } of patterns) {
    if (pattern.test(lower)) keywords.push(keyword);
  }

  return keywords.slice(0, 3);
}

// --- Speech modifiers ---

/**
 * Apply prompt-derived style to a base speech message.
 */
export function applyPromptStyleToMessage(
  baseMessage: string,
  style: DebateStyle,
  messageType: "observation" | "objection" | "defense" | "synthesis",
): string {
  let msg = baseMessage;

  // Assertiveness modifiers for objections
  if (messageType === "objection") {
    if (style.assertiveness === "assertive") {
      msg = msg.replace(/olabilir/g, "kesinlikle").replace(/risk/g, "ciddi risk");
    } else if (style.assertiveness === "cautious") {
      msg = msg.replace(/kabul edilemez/g, "dikkatle değerlendirilmeli");
    }
  }

  // Verbosity modifiers
  if (style.verbosity === "concise" && msg.length > 60) {
    // Trim to first sentence
    const firstSentence = msg.split(/[.!]/).filter(Boolean)[0];
    if (firstSentence && firstSentence.length > 15) {
      msg = firstSentence.trim() + ".";
    }
  }

  // Conservative suffix
  if (style.conservative && messageType === "objection") {
    msg += style.guardSuffix;
  }

  return msg;
}

/**
 * Generate a prompt-aware verdict summary modifier.
 */
export function buildVerdictStyleModifier(styles: DebateStyle[]): {
  summaryPrefix: string;
  actionStyle: "numbered" | "bullet";
  formality: "executive" | "standard";
} {
  const hasAssertive = styles.some((s) => s.assertiveness === "assertive");
  const hasConcise = styles.some((s) => s.verbosity === "concise");
  const hasConservative = styles.some((s) => s.conservative);

  return {
    summaryPrefix: hasConservative ? "Dikkatli değerlendirme sonucu: " : "",
    actionStyle: hasConcise ? "bullet" : "numbered",
    formality: hasAssertive ? "executive" : "standard",
  };
}
