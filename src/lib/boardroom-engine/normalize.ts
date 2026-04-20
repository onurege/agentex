// ============================================================
// Boardroom Normalization
// ============================================================
//
// Validates and normalizes raw Gemini output into
// BoardroomAnalysisResult. Guards against missing/malformed data.
// ============================================================

import type {
  BoardroomAnalysisResult,
  AgentObservation,
  AgentObjection,
  AgentDisagreement,
  AgentPerspective,
} from "./types";

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function normalizeObservations(raw: unknown): AgentObservation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o) => isString(o?.agentId) && isString(o?.message))
    .map((o) => ({
      agentId: o.agentId,
      agentName: o.agentName ?? o.agentId,
      message: String(o.message).slice(0, 300),
      topic: String(o.topic ?? "Genel").slice(0, 100),
      type: o.type === "analysis" ? "analysis" as const : "observation" as const,
    }));
}

function normalizeObjections(raw: unknown): AgentObjection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o) => isString(o?.agentId) && isString(o?.message))
    .map((o) => ({
      agentId: o.agentId,
      agentName: o.agentName ?? o.agentId,
      message: String(o.message).slice(0, 300),
      topic: String(o.topic ?? "Genel").slice(0, 100),
    }));
}

function normalizeDisagreements(raw: unknown): AgentDisagreement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => isString(d?.topic) && isString(d?.agentAId) && isString(d?.agentBId))
    .map((d) => ({
      topic: String(d.topic).slice(0, 100),
      agentAId: d.agentAId,
      agentAName: d.agentAName ?? d.agentAId,
      agentAPosition: String(d.agentAPosition ?? "").slice(0, 200),
      agentBId: d.agentBId,
      agentBName: d.agentBName ?? d.agentBId,
      agentBPosition: String(d.agentBPosition ?? "").slice(0, 200),
    }));
}

function normalizePerspectives(raw: unknown): AgentPerspective[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => isString(p?.agentId))
    .map((p) => ({
      agentId: p.agentId,
      agentName: p.agentName ?? p.agentId,
      avatar: p.avatar ?? "👤",
      position: String(p.position ?? "Değerlendirmesini tamamladı.").slice(0, 300),
    }));
}

const VALID_RISK_LEVELS = new Set(["high", "medium", "low"]);

export function normalizeBoardroomAnalysis(
  raw: Record<string, unknown>,
): BoardroomAnalysisResult {
  const observations = normalizeObservations(raw.observations);
  const objections = normalizeObjections(raw.objections);
  const disagreements = normalizeDisagreements(raw.disagreements);
  const chiefSynthesis = isString(raw.chiefSynthesis)
    ? String(raw.chiefSynthesis).slice(0, 500)
    : "Kurul görüşleri değerlendirildi.";

  const rawVerdict = (raw.verdict ?? {}) as Record<string, unknown>;
  const riskLevel = VALID_RISK_LEVELS.has(rawVerdict.riskLevel as string)
    ? (rawVerdict.riskLevel as "high" | "medium" | "low")
    : "medium";

  const decisions = Array.isArray(rawVerdict.decisions)
    ? rawVerdict.decisions.filter(isString).map((d) => String(d).slice(0, 200))
    : [];

  const actionItems = Array.isArray(rawVerdict.actionItems)
    ? rawVerdict.actionItems.filter(isString).map((a) => String(a).slice(0, 200))
    : [];

  return {
    observations,
    objections,
    disagreements,
    chiefSynthesis,
    verdict: {
      summary: isString(rawVerdict.summary)
        ? String(rawVerdict.summary).slice(0, 500)
        : "Kurul değerlendirmesi tamamlandı.",
      riskLevel,
      decisions: decisions.length > 0 ? decisions : ["Belge değerlendirmesi tamamlandı."],
      actionItems: actionItems.length > 0 ? actionItems : ["1. Detaylı inceleme yapılmalı."],
      agentPerspectives: normalizePerspectives(rawVerdict.agentPerspectives),
    },
    rebuttals: [],
    arbitratedEdits: [],
    pipeline: {
      agentResults: [],
      disagreementResult: null,
      rebuttalResult: null,
      chiefResult: null,
      stages: [],
    },
    analysisMode: "ai",
  };
}

/**
 * Validates that AI output has enough substance to be useful.
 * Returns false if the result is too thin (indicating the AI failed to produce meaningful content).
 */
export function isAnalysisUsable(result: BoardroomAnalysisResult): boolean {
  return (
    result.observations.length >= 1 &&
    result.verdict.decisions.length >= 1 &&
    result.verdict.summary.length > 20
  );
}
