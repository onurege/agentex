// ============================================================
// Correction Request Derivation
// ============================================================
//
// Derives CorrectionRequest objects from existing Gemini outputs
// (findings, revisions, disagreements) without an additional
// LLM call. Pure deterministic logic.
//
// Sources (in priority order):
//   1. Revision suggestions → cross-agent revision requests
//   2. Disagreements → resolution-based corrections
//   3. Critical findings → expertise-domain cross-references
// ============================================================

import type {
  AgentId,
  Finding,
  RevisionSuggestion,
  Disagreement,
  CorrectionRequest,
} from "../../types";

// --- Domain Mapping ---

/**
 * Map section/topic keywords to the agent most responsible for that domain.
 * Used to determine toAgentId when a revision or finding touches
 * another agent's expertise area.
 */
const DOMAIN_KEYWORDS: Array<{ keywords: string[]; agentId: AgentId }> = [
  {
    keywords: [
      "hukuk", "tazminat", "sorumluluk", "fesih", "madde", "hüküm",
      "uyumluluk", "mücbir", "münhasırlık", "sözleşme dili",
    ],
    agentId: "legal-counsel",
  },
  {
    keywords: [
      "finans", "ödeme", "komisyon", "gelir", "maliyet", "nakit",
      "fiyat", "bütçe", "kâr", "fatura",
    ],
    agentId: "finance-director",
  },
  {
    keywords: [
      "vergi", "stopaj", "kdv", "transfer fiyat", "muhasebe",
      "beyan", "matrah",
    ],
    agentId: "tax-advisor",
  },
  {
    keywords: [
      "satış", "performans", "hedef", "bölge", "ticari",
      "anlaşma", "müşteri", "pazar",
    ],
    agentId: "sales-director",
  },
  {
    keywords: [
      "ürün", "platform", "sla", "entegrasyon", "api",
      "teknik", "yazılım", "teslimat",
    ],
    agentId: "product-director",
  },
];

function inferTargetAgent(
  text: string,
  excludeAgent: AgentId,
  selectedAgents: Set<AgentId>,
): AgentId | null {
  const lower = text.toLowerCase();

  for (const { keywords, agentId } of DOMAIN_KEYWORDS) {
    if (agentId === excludeAgent) continue;
    if (!selectedAgents.has(agentId)) continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      return agentId;
    }
  }

  // Default: legal-counsel is the catch-all for contractual issues
  if (selectedAgents.has("legal-counsel") && excludeAgent !== "legal-counsel") {
    return "legal-counsel";
  }

  return null;
}

// --- Derivation ---

export interface DeriveCorrectionsInput {
  findings: Finding[];
  revisionSuggestions: RevisionSuggestion[];
  disagreements: Disagreement[];
  selectedAgents: AgentId[];
}

/**
 * Derive correction requests from existing analysis outputs.
 * Returns derived corrections + a notes array for diagnostics.
 */
export function deriveCorrectionRequests(
  input: DeriveCorrectionsInput,
): { corrections: CorrectionRequest[]; notes: string[] } {
  const selectedSet = new Set(input.selectedAgents);
  const corrections: CorrectionRequest[] = [];
  const seen = new Set<string>(); // dedup key: fromAgent|toAgent|finding
  const notes: string[] = [];
  let nextId = 1;

  const addCorrection = (
    fromAgentId: AgentId,
    toAgentId: AgentId,
    finding: string,
    correction: string,
    priority: "high" | "medium" | "low",
  ): boolean => {
    // Validate
    if (fromAgentId === toAgentId) return false;
    if (!selectedSet.has(fromAgentId) || !selectedSet.has(toAgentId)) return false;
    if (finding.length < 15 || correction.length < 15) return false;

    // Dedup
    const key = `${fromAgentId}|${toAgentId}|${finding.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);

    corrections.push({
      id: `cr-derived-${nextId++}`,
      fromAgentId,
      toAgentId,
      finding,
      correction,
      priority,
    });
    return true;
  };

  // Source 1: Revision suggestions → cross-agent corrections
  for (const rev of input.revisionSuggestions) {
    const fromAgent = rev.agentId;
    const searchText = `${rev.section} ${rev.rationale} ${rev.currentText}`;
    const toAgent = inferTargetAgent(searchText, fromAgent, selectedSet);

    if (toAgent) {
      addCorrection(
        fromAgent,
        toAgent,
        rev.section,
        rev.rationale.slice(0, 200),
        rev.priority,
      );
    }
  }

  // Source 2: Disagreements → resolution-based corrections
  for (const dis of input.disagreements) {
    if (!selectedSet.has(dis.agentAId) || !selectedSet.has(dis.agentBId)) continue;

    if (dis.resolution) {
      // The agent whose position was NOT adopted should correct
      // If resolvedBy is specified and is one of the agents, the other corrects
      const corrector =
        dis.resolvedBy === dis.agentAId ? dis.agentBId : dis.agentAId;
      const target =
        dis.resolvedBy === dis.agentAId ? dis.agentAId : dis.agentBId;

      addCorrection(
        target,
        corrector,
        dis.topic,
        dis.resolution.slice(0, 200),
        "medium",
      );
    } else {
      // Unresolved: both agents should address the topic
      addCorrection(
        dis.agentAId,
        dis.agentBId,
        dis.topic,
        dis.positionA.slice(0, 200),
        "medium",
      );
    }
  }

  // Source 3: Critical/warning findings → cross-domain corrections
  const criticalFindings = input.findings.filter(
    (f) => f.severity === "critical" || f.severity === "warning",
  );
  for (const finding of criticalFindings) {
    if (corrections.length >= 6) break; // cap total

    const searchText = `${finding.section ?? ""} ${finding.title} ${finding.description}`;
    const toAgent = inferTargetAgent(searchText, finding.agentId, selectedSet);

    if (toAgent) {
      addCorrection(
        finding.agentId,
        toAgent,
        finding.title,
        finding.description.slice(0, 200),
        finding.severity === "critical" ? "high" : "medium",
      );
    }
  }

  notes.push(`Derived ${corrections.length} corrections from ${input.revisionSuggestions.length} revisions, ${input.disagreements.length} disagreements, ${criticalFindings.length} critical/warning findings`);

  // Cap at 6
  const capped = corrections.slice(0, 6);
  if (capped.length < corrections.length) {
    notes.push(`Capped from ${corrections.length} to 6 correction requests`);
  }

  return { corrections: capped, notes };
}

/** Minimum threshold for derived corrections before falling back to mock */
export const MIN_DERIVED_CORRECTIONS = 2;
