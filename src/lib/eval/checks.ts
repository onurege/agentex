// ============================================================
// Evaluation Checks — heuristic quality scoring
// ============================================================
//
// Each check function evaluates one dimension of output quality.
// Returns a CheckResult with verdict (pass/warn/fail), score (0-100),
// and diagnostic notes.
//
// These are practical heuristics, not ground-truth comparisons.
// ============================================================

import type { CheckResult, EvalExpectations, CheckVerdict } from "./types";
import type {
  ChiefRecommendation,
  Finding,
  CorrectionRequest,
  Disagreement,
  RevisionSuggestion,
  ManagerSummary,
  DiscussionSummary,
} from "../types";
import type { ParsedDocument } from "../ingestion/types";

// --- Helper ---

function verdict(score: number): CheckVerdict {
  if (score >= 70) return "pass";
  if (score >= 40) return "warn";
  return "fail";
}

// --- 1. Extraction Quality ---

export function checkExtraction(
  doc: ParsedDocument,
  expect: EvalExpectations,
): CheckResult {
  const notes: string[] = [];
  let score = 100;

  const sectionCount = doc.sections.length;
  const clauseCount = doc.sections.reduce(
    (sum, s) => sum + (s.clauses?.length ?? 0),
    0,
  );
  const hasText = doc.fullText !== null && doc.fullText.length > 0;

  notes.push(`${sectionCount} sections, ${clauseCount} clauses`);

  if (expect.hasDocumentContent && !hasText && sectionCount === 0) {
    score -= 60;
    notes.push("No text content extracted");
  }

  if (sectionCount === 0) {
    score -= 30;
    notes.push("No sections detected");
  } else if (sectionCount < 3) {
    score -= 15;
    notes.push("Very few sections");
  }

  if (expect.expectClauseRefs && clauseCount === 0) {
    score -= 20;
    notes.push("No clause references detected");
  }

  if (doc.metadata.extractionQuality === "poor") {
    score -= 25;
    notes.push("Extraction quality rated poor");
  }

  return { name: "Extraction Quality", verdict: verdict(score), score: Math.max(0, score), notes };
}

// --- 2. Recommendation Quality ---

export function checkRecommendation(
  rec: ChiefRecommendation | null,
): CheckResult {
  const notes: string[] = [];
  let score = 100;

  if (!rec) {
    return { name: "Recommendation", verdict: "fail", score: 0, notes: ["No recommendation generated"] };
  }

  if (!rec.documentType || rec.documentType.length < 3) {
    score -= 20;
    notes.push("Document type missing or too short");
  }

  if (rec.riskCategories.length === 0) {
    score -= 30;
    notes.push("No risk categories");
  } else if (rec.riskCategories.length < 2) {
    score -= 10;
    notes.push("Very few risk categories");
  } else {
    notes.push(`${rec.riskCategories.length} risk categories`);
  }

  if (rec.recommendedAgents.length === 0) {
    score -= 30;
    notes.push("No agents recommended");
  } else {
    notes.push(`${rec.recommendedAgents.length} agents recommended`);
  }

  if (!rec.rationale || rec.rationale.length < 20) {
    score -= 15;
    notes.push("Rationale missing or too short");
  }

  return { name: "Recommendation", verdict: verdict(score), score: Math.max(0, score), notes };
}

// --- 3. Findings Coverage ---

export function checkFindingsCoverage(
  findings: Finding[],
  expect: EvalExpectations,
): CheckResult {
  const notes: string[] = [];
  let score = 100;

  notes.push(`${findings.length} findings generated`);

  if (findings.length < expect.minFindings) {
    score -= 30;
    notes.push(`Below minimum (expected >= ${expect.minFindings})`);
  }

  // Agent coverage
  const agentIds = new Set(findings.map((f) => f.agentId));
  notes.push(`${agentIds.size} agents produced findings`);
  if (agentIds.size < expect.minAgentsWithFindings) {
    score -= 25;
    notes.push(`Below agent coverage minimum (expected >= ${expect.minAgentsWithFindings})`);
  }

  // Severity distribution
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const positives = findings.filter((f) => f.severity === "positive").length;
  if (criticals === 0 && findings.length > 2) {
    score -= 10;
    notes.push("No critical findings (may miss important issues)");
  }
  if (positives === 0 && findings.length > 3) {
    score -= 10;
    notes.push("No positive findings (unbalanced analysis)");
  }

  // Clause reference coverage
  if (expect.expectClauseRefs) {
    const withClause = findings.filter((f) => f.clause && f.clause.length > 0).length;
    const ratio = findings.length > 0 ? withClause / findings.length : 0;
    notes.push(`${Math.round(ratio * 100)}% findings have clause refs`);
    if (ratio < 0.3) {
      score -= 15;
      notes.push("Low clause reference coverage");
    }
  }

  return { name: "Findings Coverage", verdict: verdict(score), score: Math.max(0, score), notes };
}

// --- 4. Findings Specificity ---

export function checkFindingsSpecificity(findings: Finding[]): CheckResult {
  const notes: string[] = [];
  let score = 100;

  if (findings.length === 0) {
    return { name: "Findings Specificity", verdict: "fail", score: 0, notes: ["No findings to evaluate"] };
  }

  // Title length
  const shortTitles = findings.filter((f) => f.title.length < 15).length;
  if (shortTitles > 0) {
    score -= shortTitles * 5;
    notes.push(`${shortTitles} findings with very short titles`);
  }

  // Description length
  const shortDescs = findings.filter((f) => f.description.length < 30).length;
  if (shortDescs > 0) {
    score -= shortDescs * 5;
    notes.push(`${shortDescs} findings with short descriptions`);
  }

  // Title = description (low effort)
  const duplicated = findings.filter(
    (f) => f.title.trim() === f.description.trim(),
  ).length;
  if (duplicated > 0) {
    score -= duplicated * 10;
    notes.push(`${duplicated} findings where title equals description`);
  }

  // Section coverage
  const withSection = findings.filter((f) => f.section && f.section.length > 0).length;
  notes.push(`${withSection}/${findings.length} findings have section refs`);

  return { name: "Findings Specificity", verdict: verdict(score), score: Math.max(0, score), notes };
}

// --- 5. Disagreement Plausibility ---

export function checkDisagreements(
  disagreements: Disagreement[],
  expect: EvalExpectations,
): CheckResult {
  const notes: string[] = [];
  let score = 100;

  notes.push(`${disagreements.length} disagreements`);

  if (expect.expectDisagreements && disagreements.length === 0) {
    score -= 40;
    notes.push("No disagreements despite multiple agents");
  }

  for (const d of disagreements) {
    if (d.positionA.length < 15 || d.positionB.length < 15) {
      score -= 10;
      notes.push(`Vague positions in: ${d.topic.slice(0, 40)}`);
    }
    if (d.positionA.trim() === d.positionB.trim()) {
      score -= 15;
      notes.push(`Identical positions in: ${d.topic.slice(0, 40)}`);
    }
  }

  const withResolution = disagreements.filter((d) => d.resolution).length;
  if (disagreements.length > 0) {
    notes.push(`${withResolution}/${disagreements.length} have resolutions`);
  }

  return { name: "Disagreements", verdict: verdict(score), score: Math.max(0, score), notes };
}

// --- 6. Revision Usefulness ---

export function checkRevisions(
  revisions: RevisionSuggestion[],
  expect: EvalExpectations,
): CheckResult {
  const notes: string[] = [];
  let score = 100;

  notes.push(`${revisions.length} revision suggestions`);

  if (revisions.length < expect.minRevisions) {
    score -= 30;
    notes.push(`Below minimum (expected >= ${expect.minRevisions})`);
  }

  for (const r of revisions) {
    if (r.currentText.trim() === r.suggestedText.trim()) {
      score -= 15;
      notes.push(`Identity revision in: ${r.section.slice(0, 40)}`);
    }
    if (r.rationale.length < 10) {
      score -= 5;
      notes.push(`Weak rationale in: ${r.section.slice(0, 40)}`);
    }
  }

  // Section diversity
  const sections = new Set(revisions.map((r) => r.section.toLowerCase()));
  if (revisions.length > 2 && sections.size < 2) {
    score -= 10;
    notes.push("All revisions target same section");
  }

  return { name: "Revisions", verdict: verdict(score), score: Math.max(0, score), notes };
}

// --- 7. Summary Completeness ---

export function checkSummary(
  manager: ManagerSummary | null,
  discussion: DiscussionSummary | null,
): CheckResult {
  const notes: string[] = [];
  let score = 100;

  if (!manager) {
    score -= 40;
    notes.push("No manager summary");
  } else {
    if (!manager.overallAssessment || manager.overallAssessment.length < 20) {
      score -= 15;
      notes.push("Overall assessment too short");
    }
    if (manager.keyFindings.length === 0) {
      score -= 10;
      notes.push("No key findings in summary");
    }
    if (manager.recommendedActions.length === 0) {
      score -= 10;
      notes.push("No recommended actions");
    }
    notes.push(`Health score: ${manager.contractHealthScore}, Risk: ${manager.riskLevel}`);
  }

  if (!discussion) {
    score -= 30;
    notes.push("No discussion summary");
  } else {
    if (discussion.consensusPoints.length === 0) {
      score -= 5;
      notes.push("No consensus points");
    }
    notes.push(`${discussion.totalFindings} findings, ${discussion.disagreements} disagreements summarized`);
  }

  return { name: "Summary", verdict: verdict(score), score: Math.max(0, score), notes };
}

// --- 8. System Reliability ---

export function checkReliability(
  findings: Finding[],
  corrections: CorrectionRequest[],
  revisions: RevisionSuggestion[],
  manager: ManagerSummary | null,
  expect: EvalExpectations,
): CheckResult {
  const notes: string[] = [];
  let score = 100;

  // No empty outputs where content expected
  if (findings.length === 0) {
    score -= 25;
    notes.push("Zero findings — possible complete failure");
  }

  if (corrections.length < expect.minCorrections) {
    score -= 15;
    notes.push(`Corrections below minimum (${corrections.length} < ${expect.minCorrections})`);
  }

  if (!manager) {
    score -= 20;
    notes.push("Manager summary missing");
  }

  // Check for degenerate outputs
  const emptyDescFindings = findings.filter((f) => f.description.length === 0).length;
  if (emptyDescFindings > 0) {
    score -= emptyDescFindings * 10;
    notes.push(`${emptyDescFindings} findings with empty descriptions`);
  }

  if (score >= 70) {
    notes.push("All outputs populated as expected");
  }

  return { name: "Reliability", verdict: verdict(score), score: Math.max(0, score), notes };
}
