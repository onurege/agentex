// ============================================================
// Draft — Warning Evaluator
// ============================================================
//
// DraftTemplate.warnings dizisini kullanıcı cevaplarına göre
// filtreler. Wizard ve preview tarafından paylaşılır.
//
// Kural: shownWhen.equals öncelikli; anyOf varsa içerme kontrolü
// yapılır. Her ikisi de yoksa uyarı hiç tetiklenmez (savunmacı).
// ============================================================

import type { DraftTemplate, TemplateWarning } from "./types";

export function evaluateWarnings(
  template: DraftTemplate,
  answers: Record<string, unknown>,
): TemplateWarning[] {
  return template.warnings.filter((w) => matchesDependency(w, answers));
}

function matchesDependency(
  warning: TemplateWarning,
  answers: Record<string, unknown>,
): boolean {
  const actual = answers[warning.shownWhen.questionId];

  if (warning.shownWhen.equals !== undefined) {
    return actual === warning.shownWhen.equals;
  }
  if (warning.shownWhen.anyOf) {
    if (Array.isArray(actual)) {
      return actual.some((v) => warning.shownWhen.anyOf?.includes(v));
    }
    return warning.shownWhen.anyOf.includes(actual);
  }
  return false;
}
