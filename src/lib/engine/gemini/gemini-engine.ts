// ============================================================
// GeminiAnalysisEngine — Hybrid Gemini + Mock implementation
// ============================================================
//
// This engine uses Gemini (via server-side API route) for:
//   - generateRecommendation() — chief agent document analysis
//   - analyze()                — findings (per agent), revisions, disagreements via Gemini;
//                                corrections derived from those outputs
//   - summarize()              — manager summary + discussion summary
//
// And delegates to MockAnalysisEngine for:
//   - buildActivityTimeline()  — UI animation events
//   - per-agent fallback       — if any agent's Gemini call fails
//   - corrections fallback     — if derivation produces < 2 requests
//
// Gemini calls go through /api/gemini (server-side) so the API key
// is never exposed to the client. This module only uses fetch().
//
// Every Gemini call produces diagnostics for observability:
//   - action name, duration, success/failure, fallback status
//   - normalization report (items dropped, quality guard notes)
// ============================================================

import type {
  AnalysisEngine,
  AnalysisSeedData,
  RecommendationInput,
  AnalysisInput,
  AnalysisOutput,
  SummaryInput,
  SummaryOutput,
  TimelineInput,
} from "../types";
import type {
  ChiefRecommendation,
  ActivityEvent,
  Finding,
  RevisionSuggestion,
  Disagreement,
  AgentId,
} from "../../types";
import type { CorrectionRequest } from "../../types";
import { MockAnalysisEngine } from "../mock-engine";
import type {
  GeminiCallDiagnostics,
  AnalysisDiagnostics,
  NormalizationReport,
} from "./diagnostics";
import {
  createEmptyDiagnostics,
  createCallDiagnostics,
  logCallResult,
  logAnalysisSummary,
} from "./diagnostics";
import {
  deriveCorrectionRequests,
  MIN_DERIVED_CORRECTIONS,
} from "./derive-corrections";

// --- API Client ---

interface GeminiAPIResponse<T> {
  result: T;
  diagnostics?: {
    normalization?: NormalizationReport;
    durationMs?: number;
  };
}

async function callGeminiAPI<T>(
  action: string,
  input: Record<string, unknown>,
): Promise<{ result: T; serverDiagnostics?: GeminiAPIResponse<T>["diagnostics"] }> {
  console.log(`[DEBUG] callGeminiAPI — action="${action}", calling /api/gemini`);
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ??
        `API request failed: ${response.status}`,
    );
  }

  const body = (await response.json()) as GeminiAPIResponse<T>;
  return { result: body.result, serverDiagnostics: body.diagnostics };
}

// --- Tracked Call Helper ---

async function trackedCall<T>(
  action: string,
  fn: () => Promise<{ result: T; serverDiagnostics?: GeminiAPIResponse<T>["diagnostics"] }>,
  diagnostics: AnalysisDiagnostics,
): Promise<{ result: T; diag: GeminiCallDiagnostics }> {
  const diag = createCallDiagnostics(action);
  const start = Date.now();

  try {
    const { result, serverDiagnostics } = await fn();
    diag.durationMs = Date.now() - start;
    diag.success = true;

    if (serverDiagnostics?.normalization) {
      diag.normalization = serverDiagnostics.normalization;
    }
    if (serverDiagnostics?.durationMs) {
      diag.durationMs = serverDiagnostics.durationMs;
    }

    logCallResult(diag);
    diagnostics.calls.push(diag);
    return { result, diag };
  } catch (err) {
    diag.durationMs = Date.now() - start;
    diag.success = false;
    diag.error = err instanceof Error ? err.message : String(err);
    logCallResult(diag);
    diagnostics.calls.push(diag);
    throw err;
  }
}

// --- Engine ---

export class GeminiAnalysisEngine implements AnalysisEngine {
  private readonly mockFallback: MockAnalysisEngine;
  private _diagnostics: AnalysisDiagnostics;

  constructor(seed: AnalysisSeedData) {
    this.mockFallback = new MockAnalysisEngine(seed);
    this._diagnostics = createEmptyDiagnostics("gemini");
  }

  /** Access accumulated diagnostics for the current analysis run */
  get diagnostics(): AnalysisDiagnostics {
    return this._diagnostics;
  }

  // ── Gemini-owned: Chief Recommendation ──────────────────────

  async generateRecommendation(
    input: RecommendationInput,
  ): Promise<ChiefRecommendation> {
    try {
      const { result } = await trackedCall(
        "recommendation",
        () =>
          callGeminiAPI<ChiefRecommendation>("recommendation", {
            document: input.document,
            businessContext: input.businessContext,
          }),
        this._diagnostics,
      );
      return result;
    } catch (err) {
      console.error("Gemini recommendation failed, falling back to mock:", err);
      const diag = this._diagnostics.calls[this._diagnostics.calls.length - 1];
      if (diag) diag.fallbackUsed = true;
      return this.mockFallback.generateRecommendation(input);
    }
  }

  // ── Gemini-driven: Analysis Pipeline ─────────────────────────
  // Findings: Gemini per agent (with per-agent mock fallback)
  // Revisions + disagreements: Gemini (with mock fallback)
  // Corrections: derived from findings + revisions + disagreements

  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    const mockOutput = await this.mockFallback.analyze(input);

    // Generate findings per agent via Gemini, then revisions + disagreements
    const findings = await this.generateAllFindings(input, mockOutput);

    const [revisions, disagreements] = await Promise.all([
      this.generateRevisions(input, mockOutput),
      this.generateDisagreements(input, mockOutput),
    ]);

    // Derive correction requests from Gemini outputs
    const correctionRequests = this.deriveCorrections(
      findings,
      revisions,
      disagreements,
      input.selectedAgents as AgentId[],
      mockOutput.correctionRequests,
    );

    return {
      findings,
      correctionRequests,
      revisionSuggestions: revisions,
      disagreements: disagreements,
    };
  }

  private deriveCorrections(
    findings: Finding[],
    revisions: RevisionSuggestion[],
    disagreements: Disagreement[],
    selectedAgents: AgentId[],
    mockFallbackCorrections: CorrectionRequest[],
  ): CorrectionRequest[] {
    const { corrections, notes } = deriveCorrectionRequests({
      findings,
      revisionSuggestions: revisions,
      disagreements,
      selectedAgents,
    });

    // Log derivation results
    if (notes.length > 0) {
      notes.forEach((n) => console.log(`[Gemini] corrections: ${n}`));
    }

    // Fallback if derivation produced too few
    if (corrections.length < MIN_DERIVED_CORRECTIONS) {
      console.log(
        `[Gemini] corrections: only ${corrections.length} derived (min ${MIN_DERIVED_CORRECTIONS}), falling back to mock`,
      );
      return mockFallbackCorrections;
    }

    return corrections;
  }

  private async generateAllFindings(
    input: AnalysisInput,
    mockOutput: AnalysisOutput,
  ): Promise<Finding[]> {
    const experts = input.selectedAgents.filter(
      (id) => id !== "chief-agent",
    ) as AgentId[];

    // Call Gemini per agent in parallel
    const perAgentResults = await Promise.all(
      experts.map((agentId) =>
        this.generateFindingsForAgent(input, agentId, mockOutput),
      ),
    );

    return perAgentResults.flat();
  }

  private async generateFindingsForAgent(
    input: AnalysisInput,
    agentId: AgentId,
    mockOutput: AnalysisOutput,
  ): Promise<Finding[]> {
    try {
      const { result } = await trackedCall(
        `findings:${agentId}`,
        () =>
          callGeminiAPI<Finding[]>("findings", {
            document: input.document,
            businessContext: input.businessContext,
            agentId,
            contextLabel:
              input.document.metadata.documentTypeGuess ?? "Sözleşme",
          }),
        this._diagnostics,
      );
      return result;
    } catch (err) {
      console.error(
        `Gemini findings for ${agentId} failed, using mock:`,
        err,
      );
      const diag =
        this._diagnostics.calls[this._diagnostics.calls.length - 1];
      if (diag) diag.fallbackUsed = true;
      // Per-agent fallback: return only this agent's mock findings
      return mockOutput.findings.filter((f) => f.agentId === agentId);
    }
  }

  private async generateRevisions(
    input: AnalysisInput,
    mockOutput: AnalysisOutput,
  ): Promise<RevisionSuggestion[]> {
    try {
      const { result } = await trackedCall(
        "revisionSuggestions",
        () =>
          callGeminiAPI<RevisionSuggestion[]>("revisionSuggestions", {
            document: input.document,
            findings: mockOutput.findings,
            selectedAgents: input.selectedAgents,
            contextLabel:
              input.document.metadata.documentTypeGuess ?? "Sözleşme",
          }),
        this._diagnostics,
      );
      return result;
    } catch (err) {
      console.error("Gemini revisions failed, using mock:", err);
      const diag = this._diagnostics.calls[this._diagnostics.calls.length - 1];
      if (diag) diag.fallbackUsed = true;
      return mockOutput.revisionSuggestions;
    }
  }

  private async generateDisagreements(
    input: AnalysisInput,
    mockOutput: AnalysisOutput,
  ): Promise<Disagreement[]> {
    try {
      const { result } = await trackedCall(
        "disagreements",
        () =>
          callGeminiAPI<Disagreement[]>("disagreements", {
            document: input.document,
            findings: mockOutput.findings,
            selectedAgents: input.selectedAgents,
            contextLabel:
              input.document.metadata.documentTypeGuess ?? "Sözleşme",
          }),
        this._diagnostics,
      );
      return result;
    } catch (err) {
      console.error("Gemini disagreements failed, using mock:", err);
      const diag = this._diagnostics.calls[this._diagnostics.calls.length - 1];
      if (diag) diag.fallbackUsed = true;
      return mockOutput.disagreements;
    }
  }

  // ── Gemini-owned: Summarization ─────────────────────────────

  async summarize(input: SummaryInput): Promise<SummaryOutput> {
    try {
      const criticalCount = input.findings.filter(
        (f) => f.severity === "critical",
      ).length;

      const [managerResult, discussionResult] = await Promise.all([
        trackedCall(
          "managerSummary",
          () =>
            callGeminiAPI("managerSummary", {
              document: input.document,
              findings: input.findings,
              disagreements: input.disagreements,
              revisionSuggestions: input.revisionSuggestions,
              contextLabel: input.contextLabel,
            }),
          this._diagnostics,
        ),
        trackedCall(
          "discussionSummary",
          () =>
            callGeminiAPI("discussionSummary", {
              document: input.document,
              findings: input.findings,
              disagreements: input.disagreements,
              contextLabel: input.contextLabel,
              actualFindings: input.findings.length,
              actualCritical: criticalCount,
              actualDisagreements: input.disagreements.length,
            }),
          this._diagnostics,
        ),
      ]);

      // Log full analysis summary after summarize (last step)
      logAnalysisSummary(this._diagnostics);

      return {
        managerSummary:
          managerResult.result as SummaryOutput["managerSummary"],
        discussionSummary:
          discussionResult.result as SummaryOutput["discussionSummary"],
      };
    } catch (err) {
      console.error(
        "Gemini summarization failed, falling back to mock:",
        err,
      );
      // Mark all summary calls as fallback
      const recentCalls = this._diagnostics.calls.slice(-2);
      for (const diag of recentCalls) {
        if (
          diag.action === "managerSummary" ||
          diag.action === "discussionSummary"
        ) {
          diag.fallbackUsed = true;
        }
      }
      logAnalysisSummary(this._diagnostics);
      return this.mockFallback.summarize(input);
    }
  }

  // ── Mock-delegated: Activity Timeline ───────────────────────

  buildActivityTimeline(input: TimelineInput): ActivityEvent[] {
    return this.mockFallback.buildActivityTimeline(input);
  }
}
