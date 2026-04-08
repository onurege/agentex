// ============================================================
// Gemini Output Normalization + Quality Guards
// ============================================================
//
// Validates and normalizes raw Gemini JSON responses into
// app-compatible type shapes. Provides safe defaults for
// missing or malformed fields.
//
// Quality guards run after normalization to reject low-value,
// duplicate, or vague outputs. Each normalizer returns a
// NormalizationReport alongside the result.
// ============================================================

import type {
  AgentId,
  ChiefRecommendation,
  RiskCategory,
  Finding,
  FindingSeverity,
  FindingCategory,
  ManagerSummary,
  DiscussionSummary,
  RevisionSuggestion,
  Disagreement,
} from "../../types";
import type { NormalizationReport } from "./diagnostics";

// --- Valid Agent IDs ---

const VALID_AGENT_IDS = new Set<string>([
  "legal-counsel",
  "finance-director",
  "tax-advisor",
  "sales-director",
  "product-director",
]);

// --- Recommendation ---

interface RawRecommendation {
  documentType?: string;
  riskCategories?: Array<{
    name?: string;
    severity?: string;
    description?: string;
  }>;
  recommendedAgents?: string[];
  rationale?: string;
}

export function normalizeRecommendationWithReport(
  raw: RawRecommendation,
): { result: ChiefRecommendation; report: NormalizationReport } {
  const result = normalizeRecommendation(raw);
  const notes: string[] = [];

  const rawAgentCount = (raw.recommendedAgents ?? []).length;
  const keptAgents = result.recommendedAgents.length;
  if (rawAgentCount > keptAgents) {
    notes.push(`${rawAgentCount - keptAgents} invalid agent IDs removed`);
  }
  if (!raw.documentType) notes.push("documentType defaulted");
  if ((raw.riskCategories ?? []).length === 0) notes.push("riskCategories defaulted");

  return {
    result,
    report: {
      inputCount: 1,
      outputCount: 1,
      droppedCount: 0,
      notes,
    },
  };
}

export function normalizeRecommendation(
  raw: RawRecommendation,
): ChiefRecommendation {
  const riskCategories: RiskCategory[] = (raw.riskCategories ?? [])
    .filter((r) => r.name && r.description)
    .map((r) => ({
      name: r.name!,
      severity: normalizeSeverity3(r.severity),
      description: r.description!,
    }));

  const recommendedAgents = (raw.recommendedAgents ?? []).filter((id) =>
    VALID_AGENT_IDS.has(id),
  ) as AgentId[];

  return {
    documentType: raw.documentType ?? "Bilinmeyen Belge Türü",
    riskCategories:
      riskCategories.length > 0
        ? riskCategories
        : [{ name: "Genel Risk", severity: "medium", description: "Detaylı analiz gerekli" }],
    recommendedAgents:
      recommendedAgents.length > 0
        ? recommendedAgents
        : (["legal-counsel", "finance-director"] as AgentId[]),
    rationale: raw.rationale ?? "Belge analiz edildi.",
  };
}

// --- Manager Summary ---

interface RawManagerSummary {
  overallAssessment?: string;
  contractHealthScore?: number;
  keyFindings?: string[];
  recommendedActions?: string[];
  riskLevel?: string;
}

export function normalizeManagerSummary(
  raw: RawManagerSummary,
): ManagerSummary {
  const result = normalizeManagerSummaryCore(raw);
  return result;
}

export function normalizeManagerSummaryWithReport(
  raw: RawManagerSummary,
): { result: ManagerSummary; report: NormalizationReport } {
  const result = normalizeManagerSummaryCore(raw);
  const notes: string[] = [];

  if (!raw.overallAssessment || raw.overallAssessment.length < 20) {
    notes.push("overallAssessment defaulted or too short");
  }
  if (raw.contractHealthScore === undefined) notes.push("contractHealthScore defaulted to 50");
  if (!raw.keyFindings || raw.keyFindings.length === 0) notes.push("keyFindings defaulted");
  if (!raw.recommendedActions || raw.recommendedActions.length === 0) notes.push("recommendedActions defaulted");

  // Quality guard: filter empty keyFindings
  result.keyFindings = result.keyFindings.filter((f) => f.trim().length > 0);
  result.recommendedActions = result.recommendedActions.filter((a) => a.trim().length > 0);

  return {
    result,
    report: { inputCount: 1, outputCount: 1, droppedCount: 0, notes },
  };
}

function normalizeManagerSummaryCore(raw: RawManagerSummary): ManagerSummary {
  return {
    overallAssessment:
      raw.overallAssessment && raw.overallAssessment.length >= 20
        ? raw.overallAssessment
        : "Analiz tamamlandı, detaylar aşağıdadır.",
    contractHealthScore: clampScore(raw.contractHealthScore ?? 50),
    keyFindings:
      raw.keyFindings && raw.keyFindings.length > 0
        ? raw.keyFindings.slice(0, 5)
        : ["Detaylı değerlendirme mevcut"],
    recommendedActions:
      raw.recommendedActions && raw.recommendedActions.length > 0
        ? raw.recommendedActions.slice(0, 6)
        : ["İnceleme sonuçlarını gözden geçirin"],
    riskLevel: normalizeSeverity3(raw.riskLevel),
  };
}

// --- Discussion Summary ---

interface RawDiscussionSummary {
  totalFindings?: number;
  criticalIssues?: number;
  disagreements?: number;
  consensusPoints?: string[];
  debateHighlights?: string[];
}

export function normalizeDiscussionSummary(
  raw: RawDiscussionSummary,
  actualFindings: number,
  actualCritical: number,
  actualDisagreements: number,
): DiscussionSummary {
  return {
    totalFindings: actualFindings,
    criticalIssues: actualCritical,
    disagreements: actualDisagreements,
    consensusPoints: raw.consensusPoints ?? [],
    debateHighlights: raw.debateHighlights ?? [],
  };
}

export function normalizeDiscussionSummaryWithReport(
  raw: RawDiscussionSummary,
  actualFindings: number,
  actualCritical: number,
  actualDisagreements: number,
): { result: DiscussionSummary; report: NormalizationReport } {
  const result = normalizeDiscussionSummary(
    raw,
    actualFindings,
    actualCritical,
    actualDisagreements,
  );
  const notes: string[] = [];

  // Quality guard: filter empty strings
  result.consensusPoints = result.consensusPoints.filter((p) => p.trim().length > 0);
  result.debateHighlights = result.debateHighlights.filter((h) => h.trim().length > 0);

  if ((raw.consensusPoints ?? []).length === 0) notes.push("consensusPoints empty from Gemini");
  if ((raw.debateHighlights ?? []).length === 0 && actualDisagreements > 0) {
    notes.push("debateHighlights empty despite disagreements existing");
  }

  return {
    result,
    report: { inputCount: 1, outputCount: 1, droppedCount: 0, notes },
  };
}

// --- Revision Suggestions ---

interface RawRevisionSuggestion {
  agentId?: string;
  section?: string;
  currentText?: string;
  suggestedText?: string;
  rationale?: string;
  priority?: string;
}

interface RawRevisionSuggestionsResponse {
  revisionSuggestions?: RawRevisionSuggestion[];
}

export function normalizeRevisionSuggestions(
  raw: RawRevisionSuggestionsResponse,
  validAgents: Set<string>,
): { result: RevisionSuggestion[]; report: NormalizationReport } {
  const suggestions = raw.revisionSuggestions ?? [];
  const inputCount = suggestions.length;
  const notes: string[] = [];

  // Step 1: Basic normalization (required fields + valid agent)
  const normalized = suggestions
    .filter(
      (r) =>
        r.agentId &&
        validAgents.has(r.agentId) &&
        r.section &&
        r.currentText &&
        r.suggestedText,
    )
    .map((r, i) => ({
      id: `rev-gemini-${i + 1}`,
      agentId: r.agentId as AgentId,
      section: r.section!,
      currentText: r.currentText!,
      suggestedText: r.suggestedText!,
      rationale: r.rationale ?? "Revizyon gerekli.",
      priority: normalizePriority(r.priority),
    }));

  const afterBasic = normalized.length;
  if (afterBasic < inputCount) {
    notes.push(`${inputCount - afterBasic} revisions dropped (missing fields or invalid agent)`);
  }

  // Step 2: Quality guards
  let result = normalized;

  // Guard: currentText must differ from suggestedText
  const beforeIdentical = result.length;
  result = result.filter((r) => r.currentText.trim() !== r.suggestedText.trim());
  if (result.length < beforeIdentical) {
    notes.push(`${beforeIdentical - result.length} revisions dropped (identical current/suggested text)`);
  }

  // Guard: minimum text length (10 chars)
  const beforeShort = result.length;
  result = result.filter(
    (r) => r.currentText.length >= 10 && r.suggestedText.length >= 10,
  );
  if (result.length < beforeShort) {
    notes.push(`${beforeShort - result.length} revisions dropped (text too short)`);
  }

  // Guard: deduplicate by section name
  const seenSections = new Set<string>();
  const beforeDedup = result.length;
  result = result.filter((r) => {
    const key = r.section.toLowerCase().trim();
    if (seenSections.has(key)) return false;
    seenSections.add(key);
    return true;
  });
  if (result.length < beforeDedup) {
    notes.push(`${beforeDedup - result.length} revisions dropped (duplicate section)`);
  }

  // Re-index IDs after filtering
  result = result.map((r, i) => ({ ...r, id: `rev-gemini-${i + 1}` }));

  return {
    result,
    report: {
      inputCount,
      outputCount: result.length,
      droppedCount: inputCount - result.length,
      notes,
    },
  };
}

// --- Disagreements ---

interface RawDisagreement {
  agentAId?: string;
  agentBId?: string;
  topic?: string;
  positionA?: string;
  positionB?: string;
  resolution?: string | null;
  resolvedBy?: string | null;
}

interface RawDisagreementsResponse {
  disagreements?: RawDisagreement[];
}

export function normalizeDisagreements(
  raw: RawDisagreementsResponse,
  validAgents: Set<string>,
): { result: Disagreement[]; report: NormalizationReport } {
  const disagreements = raw.disagreements ?? [];
  const inputCount = disagreements.length;
  const notes: string[] = [];

  // Step 1: Basic normalization
  const normalized = disagreements
    .filter(
      (d) =>
        d.agentAId &&
        d.agentBId &&
        d.agentAId !== d.agentBId &&
        validAgents.has(d.agentAId) &&
        validAgents.has(d.agentBId) &&
        d.topic &&
        d.positionA &&
        d.positionB,
    )
    .map((d, i) => ({
      id: `dis-gemini-${i + 1}`,
      agentAId: d.agentAId as AgentId,
      agentBId: d.agentBId as AgentId,
      topic: d.topic!,
      positionA: d.positionA!,
      positionB: d.positionB!,
      resolution: d.resolution ?? undefined,
      resolvedBy:
        d.resolvedBy && validAgents.has(d.resolvedBy)
          ? (d.resolvedBy as AgentId)
          : undefined,
    }));

  const afterBasic = normalized.length;
  if (afterBasic < inputCount) {
    notes.push(`${inputCount - afterBasic} disagreements dropped (missing fields or invalid agents)`);
  }

  // Step 2: Quality guards
  let result = normalized;

  // Guard: positions must actually differ
  const beforeIdentical = result.length;
  result = result.filter(
    (d) => d.positionA.trim() !== d.positionB.trim(),
  );
  if (result.length < beforeIdentical) {
    notes.push(`${beforeIdentical - result.length} disagreements dropped (identical positions)`);
  }

  // Guard: minimum content length (topic >= 5, positions >= 15)
  const beforeVague = result.length;
  result = result.filter(
    (d) =>
      d.topic.length >= 5 &&
      d.positionA.length >= 15 &&
      d.positionB.length >= 15,
  );
  if (result.length < beforeVague) {
    notes.push(`${beforeVague - result.length} disagreements dropped (too vague)`);
  }

  // Guard: deduplicate by agent pair
  const seenPairs = new Set<string>();
  const beforeDedup = result.length;
  result = result.filter((d) => {
    const pair = [d.agentAId, d.agentBId].sort().join("|");
    if (seenPairs.has(pair)) return false;
    seenPairs.add(pair);
    return true;
  });
  if (result.length < beforeDedup) {
    notes.push(`${beforeDedup - result.length} disagreements dropped (duplicate agent pair)`);
  }

  // Re-index IDs
  result = result.map((d, i) => ({ ...d, id: `dis-gemini-${i + 1}` }));

  return {
    result,
    report: {
      inputCount,
      outputCount: result.length,
      droppedCount: inputCount - result.length,
      notes,
    },
  };
}

// --- Findings ---

interface RawFinding {
  agentId?: string;
  category?: string;
  severity?: string;
  title?: string;
  description?: string;
  clause?: string | null;
  section?: string | null;
}

interface RawFindingsResponse {
  findings?: RawFinding[];
}

const VALID_SEVERITIES = new Set(["critical", "warning", "info", "positive"]);
const VALID_CATEGORIES = new Set(["critical-issue", "missing-risky", "sufficient-positive"]);

/**
 * Map severity to the most consistent category if category is invalid.
 */
function inferCategory(severity: FindingSeverity): FindingCategory {
  switch (severity) {
    case "critical": return "critical-issue";
    case "warning": return "missing-risky";
    case "positive": return "sufficient-positive";
    case "info": return "missing-risky";
  }
}

export function normalizeFindings(
  raw: RawFindingsResponse,
  expectedAgentId: string,
): { result: Finding[]; report: NormalizationReport } {
  const rawFindings = raw.findings ?? [];
  const inputCount = rawFindings.length;
  const notes: string[] = [];

  // Step 1: Basic normalization
  const normalized: Finding[] = rawFindings
    .filter((f) => f.title && f.description)
    .map((f, i) => {
      const severity = VALID_SEVERITIES.has(f.severity ?? "")
        ? (f.severity as FindingSeverity)
        : "warning";

      const category = VALID_CATEGORIES.has(f.category ?? "")
        ? (f.category as FindingCategory)
        : inferCategory(severity);

      // Force agentId to expected value (ignore LLM hallucination)
      const agentId = (
        VALID_AGENT_IDS.has(f.agentId ?? "") ? f.agentId : expectedAgentId
      ) as AgentId;

      return {
        id: `f-gemini-${expectedAgentId}-${i + 1}`,
        agentId,
        category,
        severity,
        title: f.title!,
        description: f.description!,
        clause: f.clause ?? undefined,
        section: f.section ?? undefined,
      };
    });

  const afterBasic = normalized.length;
  if (afterBasic < inputCount) {
    notes.push(`${inputCount - afterBasic} findings dropped (missing title or description)`);
  }

  // Step 2: Quality guards
  let result = normalized;

  // Guard: title minimum length (10 chars)
  const beforeTitleShort = result.length;
  result = result.filter((f) => f.title.length >= 10);
  if (result.length < beforeTitleShort) {
    notes.push(`${beforeTitleShort - result.length} findings dropped (title too short)`);
  }

  // Guard: description minimum length (20 chars)
  const beforeDescShort = result.length;
  result = result.filter((f) => f.description.length >= 20);
  if (result.length < beforeDescShort) {
    notes.push(`${beforeDescShort - result.length} findings dropped (description too short)`);
  }

  // Guard: title must differ from description
  const beforeIdentical = result.length;
  result = result.filter((f) => f.title.trim() !== f.description.trim());
  if (result.length < beforeIdentical) {
    notes.push(`${beforeIdentical - result.length} findings dropped (title equals description)`);
  }

  // Guard: deduplicate by exact title match
  const seenTitles = new Set<string>();
  const beforeDedup = result.length;
  result = result.filter((f) => {
    const key = f.title.toLowerCase().trim();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
  if (result.length < beforeDedup) {
    notes.push(`${beforeDedup - result.length} findings dropped (duplicate title)`);
  }

  // Re-index IDs
  result = result.map((f, i) => ({
    ...f,
    id: `f-gemini-${expectedAgentId}-${i + 1}`,
  }));

  return {
    result,
    report: {
      inputCount,
      outputCount: result.length,
      droppedCount: inputCount - result.length,
      notes,
    },
  };
}

// --- Helpers ---

function normalizeSeverity3(value?: string): "high" | "medium" | "low" {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function normalizePriority(value?: string): "high" | "medium" | "low" {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
