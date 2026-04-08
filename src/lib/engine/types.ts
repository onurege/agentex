// ============================================================
// Analysis Engine — Interface for multi-agent contract analysis
// ============================================================
//
// This interface abstracts the analysis pipeline so that the current
// mock implementation can later be swapped with real LLM-based agents.
//
// All methods are async (return Promises) to support future
// network-based AI providers even though the mock resolves instantly.
//
// Engine inputs are centered on ParsedDocument (normalized content)
// and BusinessContext. The engine never accesses scenarios directly.
// ============================================================

import type {
  BusinessContext,
  AgentId,
  ChiefRecommendation,
  Finding,
  CorrectionRequest,
  Disagreement,
  RevisionSuggestion,
  ManagerSummary,
  DiscussionSummary,
  ActivityEvent,
} from "../types";
import type { ParsedDocument } from "../ingestion/types";

// --- Engine Input / Output Types ---

/** Input for chief agent recommendation generation */
export interface RecommendationInput {
  document: ParsedDocument;
  businessContext: BusinessContext;
}

/** Input for the full multi-agent analysis pipeline */
export interface AnalysisInput {
  document: ParsedDocument;
  businessContext: BusinessContext;
  selectedAgents: AgentId[];
}

/** Raw analysis output — findings, corrections, disagreements, revisions */
export interface AnalysisOutput {
  findings: Finding[];
  correctionRequests: CorrectionRequest[];
  disagreements: Disagreement[];
  revisionSuggestions: RevisionSuggestion[];
}

/** Input for summary generation (post-analysis) */
export interface SummaryInput {
  document: ParsedDocument;
  findings: Finding[];
  disagreements: Disagreement[];
  revisionSuggestions: RevisionSuggestion[];
  contextLabel: string;
}

/** Summary output — manager + discussion summaries */
export interface SummaryOutput {
  managerSummary: ManagerSummary;
  discussionSummary: DiscussionSummary;
}

/** Input for activity timeline generation */
export interface TimelineInput {
  document: ParsedDocument;
  selectedAgents: AgentId[];
  contextLabel: string;
}

// --- Seed Data (for mock engine) ---

/**
 * Pre-computed analysis data injected into MockAnalysisEngine.
 *
 * This is the explicit boundary between scenario data and the engine.
 * The factory extracts seed data from a DemoScenario and passes it here.
 * The engine never imports or calls getScenario() directly.
 *
 * A future LLMAnalysisEngine would ignore seed data entirely and
 * generate results from ParsedDocument content via LLM calls.
 */
export interface AnalysisSeedData {
  chiefRecommendation: ChiefRecommendation;
  findings: Finding[];
  correctionRequests: CorrectionRequest[];
  disagreements: Disagreement[];
  revisionSuggestions: RevisionSuggestion[];
  contextLabel: string;
}

// --- Engine Interface ---

/**
 * AnalysisEngine — core abstraction for the multi-agent analysis pipeline.
 *
 * Current implementation: MockAnalysisEngine (uses injected seed data)
 * Future implementation: LLMAnalysisEngine (real AI agent orchestration)
 *
 * Lifecycle:
 *   1. generateRecommendation() — Chief agent analyzes document → risk areas + agent recommendations
 *   2. analyze()                — Selected agents review document → findings, corrections, disagreements, revisions
 *   3. summarize()              — Chief agent synthesizes results → manager summary + discussion summary
 *   4. buildActivityTimeline()  — Generate UI activity events for the orchestration timeline
 *
 * All methods receive ParsedDocument as part of their input.
 * The engine is input-driven — it does not access external data sources.
 */
export interface AnalysisEngine {
  /**
   * Generate the chief agent's document recommendation.
   * Identifies risk areas and suggests which expert agents to involve.
   *
   * Mock: returns seed data recommendation
   * Future: LLM analyzes ParsedDocument.sections and fullText
   */
  generateRecommendation(input: RecommendationInput): Promise<ChiefRecommendation>;

  /**
   * Run the full multi-agent analysis pipeline.
   * Each selected agent reviews the document from their expertise perspective.
   * Returns agent-filtered results (only findings from selected agents).
   *
   * Mock: filters seed data by selectedAgents
   * Future: runs parallel LLM agents against ParsedDocument content
   */
  analyze(input: AnalysisInput): Promise<AnalysisOutput>;

  /**
   * Generate manager summary and discussion summary from analysis results.
   * Called after analyze() with the filtered output.
   *
   * Mock: computes scores and text dynamically from filtered findings
   * Future: LLM synthesizes a narrative summary from agent outputs + document
   */
  summarize(input: SummaryInput): Promise<SummaryOutput>;

  /**
   * Build a deterministic activity event timeline for the UI.
   * These events are played back on a timer during the orchestration animation.
   *
   * Mock: generates timed events from seed data
   * Future: could return estimated progress events, or be replaced
   *         by real-time streaming from the agent orchestration
   */
  buildActivityTimeline(input: TimelineInput): ActivityEvent[];
}
