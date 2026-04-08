// ============================================================
// Evaluation Types
// ============================================================

import type { AgentId, BusinessContext } from "../types";
import type { ParsedDocument } from "../ingestion/types";
import type { AnalysisProvider } from "../engine";

// --- Eval Case ---

export interface EvalCase {
  id: string;
  name: string;
  description: string;
  scenarioId?: string;
  document: ParsedDocument;
  businessContext: BusinessContext;
  selectedAgents: AgentId[];
  expectations: EvalExpectations;
}

export interface EvalExpectations {
  /** Minimum number of findings expected */
  minFindings: number;
  /** Minimum number of agents that should produce findings */
  minAgentsWithFindings: number;
  /** Whether clause references are expected in findings */
  expectClauseRefs: boolean;
  /** Minimum number of revision suggestions */
  minRevisions: number;
  /** Whether disagreements are expected (usually true with 3+ agents) */
  expectDisagreements: boolean;
  /** Minimum correction requests */
  minCorrections: number;
  /** Whether the document has real text content */
  hasDocumentContent: boolean;
}

// --- Eval Results ---

export type CheckVerdict = "pass" | "warn" | "fail";

export interface CheckResult {
  name: string;
  verdict: CheckVerdict;
  score: number; // 0-100
  notes: string[];
}

export interface EvalResult {
  caseId: string;
  caseName: string;
  provider: AnalysisProvider;
  durationMs: number;
  checks: CheckResult[];
  overallScore: number; // 0-100 average
  overallVerdict: CheckVerdict;
  error?: string;
}

export interface EvalSummary {
  timestamp: string;
  provider: AnalysisProvider;
  results: EvalResult[];
  totalScore: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}
