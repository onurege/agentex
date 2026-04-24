// ============================================================
// Template Validator
// ============================================================
//
// Şablon tanımlarının tutarlılığını build-time kontrol eder:
// unique id'ler, dependsOn/requires referanslarının gerçekten
// var olan question'ları işaret etmesi, order dupe yok, gerekli
// alanların doldurulmuş olması. Unit testlerde çağrılır; bozuk
// şablon shipping'i engellemek için CI'da da çalıştırılabilir.
// ============================================================

import type { DraftTemplate } from "../types";

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export function validateTemplate(
  template: DraftTemplate,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const questionIds = new Set<string>();
  const clauseIds = new Set<string>();
  const clauseOrders = new Set<number>();

  for (const q of template.questions) {
    if (questionIds.has(q.id)) {
      issues.push({
        severity: "error",
        message: `Duplicate question id: ${q.id}`,
      });
    }
    questionIds.add(q.id);
    if (q.required && q.type === "checkbox" && q.defaultValue === undefined) {
      issues.push({
        severity: "warning",
        message: `Question ${q.id} is required checkbox with no default; users will hit required-but-empty state.`,
      });
    }
  }

  for (const q of template.questions) {
    if (q.dependsOn && !questionIds.has(q.dependsOn.questionId)) {
      issues.push({
        severity: "error",
        message: `Question ${q.id} dependsOn unknown question: ${q.dependsOn.questionId}`,
      });
    }
  }

  for (const c of template.clauses) {
    if (clauseIds.has(c.id)) {
      issues.push({
        severity: "error",
        message: `Duplicate clause id: ${c.id}`,
      });
    }
    clauseIds.add(c.id);

    if (clauseOrders.has(c.order)) {
      issues.push({
        severity: "error",
        message: `Duplicate clause order: ${c.order} (clauseId=${c.id})`,
      });
    }
    clauseOrders.add(c.order);

    for (const req of c.requires) {
      if (!questionIds.has(req)) {
        issues.push({
          severity: "error",
          message: `Clause ${c.id} requires unknown question: ${req}`,
        });
      }
    }

    if (c.required && !c.defaultEnabled) {
      issues.push({
        severity: "error",
        message: `Clause ${c.id} is required but defaultEnabled is false (contradiction).`,
      });
    }
  }

  for (const w of template.warnings) {
    if (!questionIds.has(w.shownWhen.questionId)) {
      issues.push({
        severity: "error",
        message: `Warning ${w.id} shownWhen references unknown question: ${w.shownWhen.questionId}`,
      });
    }
  }

  return issues;
}
