// ============================================================
// Evaluation Harness — Public API
// ============================================================
//
// Lightweight developer-facing evaluation for the contract review system.
//
// Usage:
//   import { runEvalCase, runAllCases, formatEvalSummary } from "@/lib/eval";
//
//   // Run single case
//   const result = await runEvalCase("distributor", "mock");
//
//   // Run all cases and print summary
//   const summary = await runAllCases("mock");
//   console.log(formatEvalSummary(summary));
//
// Eval dimensions:
//   1. Extraction Quality    — sections, clauses, text content
//   2. Recommendation        — risk categories, agent suggestions, rationale
//   3. Findings Coverage     — count, agent spread, severity mix, clause refs
//   4. Findings Specificity  — title/description quality, section references
//   5. Disagreements         — plausibility, position quality, resolutions
//   6. Revisions             — usefulness, diversity, rationale quality
//   7. Summary               — assessment, scores, actions, highlights
//   8. Reliability           — no empty/broken outputs
// ============================================================

// Types
export type {
  EvalCase,
  EvalExpectations,
  CheckVerdict,
  CheckResult,
  EvalResult,
  EvalSummary,
} from "./types";

// Cases
export { getEvalCases, getEvalCase } from "./cases";

// Runner
export { runEvalCase, runAllCases, formatEvalSummary } from "./runner";
