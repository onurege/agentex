// ============================================================
// Evaluation Runner — executes eval cases through the pipeline
// ============================================================
//
// Developer-facing harness. Not a production test suite.
//
// Usage:
//   import { runEvalCase, runAllCases } from "@/lib/eval";
//   const result = await runEvalCase("distributor", "mock");
//   const summary = await runAllCases("mock");
// ============================================================

import type { EvalCase, EvalResult, EvalSummary, CheckResult, CheckVerdict } from "./types";
import type { AnalysisProvider } from "../engine";
import { createAnalysisEngine } from "../engine";
import type { AnalysisOutput, SummaryOutput } from "../engine/types";
import type { ChiefRecommendation } from "../types";
import { getEvalCases, getEvalCase } from "./cases";
import {
  checkExtraction,
  checkRecommendation,
  checkFindingsCoverage,
  checkFindingsSpecificity,
  checkDisagreements,
  checkRevisions,
  checkSummary,
  checkReliability,
} from "./checks";

// --- Run Single Case ---

export async function runEvalCase(
  caseId: string,
  provider: AnalysisProvider = "mock",
): Promise<EvalResult> {
  const evalCase = getEvalCase(caseId);
  if (!evalCase) {
    return {
      caseId,
      caseName: "Unknown",
      provider,
      durationMs: 0,
      checks: [],
      overallScore: 0,
      overallVerdict: "fail",
      error: `Eval case not found: ${caseId}`,
    };
  }

  return executeCase(evalCase, provider);
}

// --- Run All Cases ---

export async function runAllCases(
  provider: AnalysisProvider = "mock",
): Promise<EvalSummary> {
  const cases = getEvalCases();
  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    const result = await executeCase(evalCase, provider);
    results.push(result);
  }

  const allChecks = results.flatMap((r) => r.checks);
  const totalScore =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length)
      : 0;

  return {
    timestamp: new Date().toISOString(),
    provider,
    results,
    totalScore,
    passCount: allChecks.filter((c) => c.verdict === "pass").length,
    warnCount: allChecks.filter((c) => c.verdict === "warn").length,
    failCount: allChecks.filter((c) => c.verdict === "fail").length,
  };
}

// --- Execute Case ---

async function executeCase(
  evalCase: EvalCase,
  provider: AnalysisProvider,
): Promise<EvalResult> {
  const start = Date.now();

  try {
    // Create engine
    const engine = evalCase.scenarioId
      ? createAnalysisEngine({ scenarioId: evalCase.scenarioId }, provider)
      : createAnalysisEngine(
          {
            seedData: {
              chiefRecommendation: {
                documentType: "Bilinmeyen",
                riskCategories: [],
                recommendedAgents: [],
                rationale: "",
              },
              findings: [],
              correctionRequests: [],
              disagreements: [],
              revisionSuggestions: [],
              contextLabel: evalCase.name,
            },
          },
          provider,
        );

    // Run pipeline
    const recommendation: ChiefRecommendation =
      await engine.generateRecommendation({
        document: evalCase.document,
        businessContext: evalCase.businessContext,
      });

    const analysis: AnalysisOutput = await engine.analyze({
      document: evalCase.document,
      businessContext: evalCase.businessContext,
      selectedAgents: evalCase.selectedAgents,
    });

    const summary: SummaryOutput = await engine.summarize({
      document: evalCase.document,
      findings: analysis.findings,
      disagreements: analysis.disagreements,
      revisionSuggestions: analysis.revisionSuggestions,
      contextLabel: evalCase.name,
    });

    // Run checks
    const checks: CheckResult[] = [
      checkExtraction(evalCase.document, evalCase.expectations),
      checkRecommendation(recommendation),
      checkFindingsCoverage(analysis.findings, evalCase.expectations),
      checkFindingsSpecificity(analysis.findings),
      checkDisagreements(analysis.disagreements, evalCase.expectations),
      checkRevisions(analysis.revisionSuggestions, evalCase.expectations),
      checkSummary(summary.managerSummary, summary.discussionSummary),
      checkReliability(
        analysis.findings,
        analysis.correctionRequests,
        analysis.revisionSuggestions,
        summary.managerSummary,
        evalCase.expectations,
      ),
    ];

    const overallScore =
      checks.length > 0
        ? Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length)
        : 0;

    const overallVerdict: CheckVerdict =
      checks.some((c) => c.verdict === "fail")
        ? "fail"
        : checks.some((c) => c.verdict === "warn")
          ? "warn"
          : "pass";

    return {
      caseId: evalCase.id,
      caseName: evalCase.name,
      provider,
      durationMs: Date.now() - start,
      checks,
      overallScore,
      overallVerdict,
    };
  } catch (err) {
    return {
      caseId: evalCase.id,
      caseName: evalCase.name,
      provider,
      durationMs: Date.now() - start,
      checks: [],
      overallScore: 0,
      overallVerdict: "fail",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Formatting ---

export function formatEvalSummary(summary: EvalSummary): string {
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════╗");
  lines.push(`║  Eval Summary — provider: ${summary.provider.padEnd(30)}║`);
  lines.push("╠══════════════════════════════════════════════════════════╣");

  for (const result of summary.results) {
    const icon =
      result.overallVerdict === "pass"
        ? "✓"
        : result.overallVerdict === "warn"
          ? "△"
          : "✗";
    lines.push(
      `║  ${icon} ${result.caseName.slice(0, 35).padEnd(35)} ${String(result.overallScore).padStart(3)}% ${String(result.durationMs).padStart(5)}ms ║`,
    );

    if (result.error) {
      lines.push(`║    ERROR: ${result.error.slice(0, 46).padEnd(46)}║`);
    }

    for (const check of result.checks) {
      if (check.verdict !== "pass") {
        const checkIcon = check.verdict === "warn" ? "△" : "✗";
        lines.push(
          `║    ${checkIcon} ${check.name.padEnd(22)} ${String(check.score).padStart(3)}%  ${check.notes[0]?.slice(0, 22) ?? ""}  ║`,
        );
      }
    }
  }

  lines.push("╠══════════════════════════════════════════════════════════╣");
  lines.push(
    `║  Total: ${String(summary.totalScore).padStart(3)}%  |  ✓${String(summary.passCount).padStart(2)}  △${String(summary.warnCount).padStart(2)}  ✗${String(summary.failCount).padStart(2)}                      ║`,
  );
  lines.push("╚══════════════════════════════════════════════════════════╝");

  return lines.join("\n");
}
