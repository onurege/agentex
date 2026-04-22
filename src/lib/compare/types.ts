// ============================================================
// Compare Module — Types
// ============================================================
//
// The compare module is fully isolated from boardroom. It models a
// single kind of work: diff two contract versions and surface the
// changes with risk annotations. Store, routes, and components are
// separate; only low-level infra (document parsing, redline render)
// is shared — imported read-only.
// ============================================================

/** What kind of change this finding represents. */
export type CompareFindingType =
  | "added"            // clause exists in v2, not in v1
  | "removed"          // clause exists in v1, not in v2
  | "reworded"         // same intent, different wording
  | "numeric_change"   // amount / rate / period shifted
  | "material"         // substantive change of obligation
  | "cosmetic";        // whitespace / typo / formatting only

/** Risk weight attached to a finding by the analysis agent. */
export type CompareRiskLevel = "low" | "medium" | "high";

/** Which side of the deal the change tilts toward. */
export type ComparePartyImpact =
  | "favors_buyer"
  | "favors_seller"
  | "neutral"
  | "mutual_risk";

/** One discrete change between v1 and v2. */
export interface CompareFinding {
  id: string;
  /** Human-facing clause reference — e.g. "Madde 4.2" or "Ek-1, 3. bent". */
  clauseRef: string;
  clauseTitle?: string;
  type: CompareFindingType;
  riskLevel: CompareRiskLevel;
  /** v1 text for the clause — null when finding is `added`. */
  v1Text: string | null;
  /** v2 text for the clause — null when finding is `removed`. */
  v2Text: string | null;
  /** One-sentence summary for list views. */
  summary: string;
  /** Longer explanation of the business impact. */
  impact: string;
  partyImpact: ComparePartyImpact;
}

export interface CompareDocumentMeta {
  fileName: string;
  sizeBytes: number;
  /** ISO string; when the upload was parsed. */
  parsedAt: string;
}

export interface CompareStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  added: number;
  removed: number;
  reworded: number;
  numericChanged: number;
  cosmetic: number;
}

export type CompareRunStatus = "analyzing" | "complete" | "error";

export interface CompareRun {
  id: string;
  createdAt: string;
  status: CompareRunStatus;
  /** Populated when status === "error". */
  errorMessage?: string;
  v1: CompareDocumentMeta;
  v2: CompareDocumentMeta;
  findings: CompareFinding[];
  stats: CompareStats;
}

/** Derived helper — counts by finding type + risk for dashboard stats. */
export function deriveStats(findings: CompareFinding[]): CompareStats {
  const stats: CompareStats = {
    total: findings.length,
    high: 0,
    medium: 0,
    low: 0,
    added: 0,
    removed: 0,
    reworded: 0,
    numericChanged: 0,
    cosmetic: 0,
  };
  for (const f of findings) {
    if (f.riskLevel === "high") stats.high++;
    else if (f.riskLevel === "medium") stats.medium++;
    else stats.low++;

    switch (f.type) {
      case "added":
        stats.added++;
        break;
      case "removed":
        stats.removed++;
        break;
      case "reworded":
        stats.reworded++;
        break;
      case "numeric_change":
        stats.numericChanged++;
        break;
      case "cosmetic":
        stats.cosmetic++;
        break;
      case "material":
        // Material sits across types; not double-counted in type buckets.
        break;
    }
  }
  return stats;
}
