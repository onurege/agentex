"use client";

// ============================================================
// WizardShell — Step bazlı soru-cevap yöneticisi
// ============================================================
//
// Template'in questions dizisini step numarasına göre gruplar,
// aktif adımda görünür (dependsOn matched) soruları render eder
// ve Geri / İleri navigasyonunu yönetir. Son adımda "Önizlemeye
// geç" CTA'sı gösterir. Değer değişimi doğrudan store'a yazar
// (updateAnswer). Clause toggle + preview panel commit 4'te
// WizardShell'in sağına eklenecek.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { DraftTemplate, Question } from "@/lib/draft/types";
import { useDraftStore } from "@/lib/draft/store";
import { evaluateWarnings } from "@/lib/draft/warnings";
import { WarningBanner } from "./WarningBanner";
import { WizardQuestion } from "./WizardQuestion";

interface WizardShellProps {
  template: DraftTemplate;
  sessionId: string;
  /** Last step → Preview modu. Commit 4 split layout bunu override edecek. */
  onComplete?(): void;
}

export function WizardShell({
  template,
  sessionId,
  onComplete,
}: WizardShellProps) {
  const session = useDraftStore((s) => s.getSession(sessionId));
  const updateAnswer = useDraftStore((s) => s.updateAnswer);

  const steps = useMemo(() => deriveSteps(template), [template]);
  const [currentStep, setCurrentStep] = useState(1);

  // Soru tanımındaki defaultValue'ları store'a seed et — kullanıcı
  // alana dokunmasa bile required check pass olsun. Sadece mount'ta
  // + template/session değişince çalışır; mevcut cevapları ezmez.
  useEffect(() => {
    const current = useDraftStore.getState().sessions[sessionId];
    if (!current) return;
    for (const q of template.questions) {
      if (q.defaultValue === undefined) continue;
      if (current.answers[q.id] !== undefined) continue;
      useDraftStore.getState().updateAnswer(sessionId, q.id, q.defaultValue);
    }
  }, [template, sessionId]);

  if (!session) return null;

  const visibleQuestions = template.questions
    .filter((q) => q.step === currentStep)
    .filter((q) => isQuestionVisible(q, session.answers));

  const groupName = visibleQuestions[0]?.group ?? "Sorular";
  const isLastStep = currentStep === steps.length;

  const canAdvance = visibleQuestions.every((q) => {
    if (!q.required) return true;
    const v = session.answers[q.id];
    return !isEmpty(v);
  });

  const activeWarnings = evaluateWarnings(template, session.answers);

  return (
    <div className="space-y-6">
      {/* Step progress */}
      <ol className="flex items-center gap-2 flex-wrap">
        {steps.map((step) => {
          const reached = step <= currentStep;
          const active = step === currentStep;
          return (
            <li key={step} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(step)}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-mono font-semibold border transition-colors ${
                  active
                    ? "bg-accent-primary text-workspace-surface border-accent-primary"
                    : reached
                      ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                      : "bg-workspace-surface text-text-tertiary border-workspace-border"
                }`}
                aria-label={`Adım ${step}`}
              >
                {step < currentStep ? <Check size={14} /> : step}
              </button>
              {step < steps.length && (
                <span
                  aria-hidden
                  className={`w-6 h-px ${
                    step < currentStep
                      ? "bg-accent-primary/50"
                      : "bg-workspace-border"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Group header */}
      <header>
        <div className="text-xs font-mono font-semibold tracking-widest uppercase text-accent-primary mb-1">
          Adım {currentStep} / {steps.length}
        </div>
        <h2 className="font-display text-xl font-semibold text-text-primary">
          {groupName}
        </h2>
      </header>

      {/* Questions */}
      <div className="space-y-5">
        {visibleQuestions.map((q) => (
          <WizardQuestion
            key={q.id}
            question={q}
            value={session.answers[q.id] ?? q.defaultValue}
            onChange={(value) => updateAnswer(sessionId, q.id, value)}
          />
        ))}
      </div>

      {/* Template warnings — cevaplara göre filtrelenir, tüm adımlarda
          görünür olabilir (örn. step 2'deki 'mutual' cevabı step 5'te
          hâlâ geçerli bir uyarı doğurabilir). */}
      <WarningBanner warnings={activeWarnings} />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-workspace-border">
        <button
          type="button"
          disabled={currentStep === 1}
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-workspace-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft size={15} />
          Geri
        </button>

        {!canAdvance && (
          <span className="text-xs text-text-tertiary">
            Zorunlu alanları doldurun.
          </span>
        )}

        {isLastStep ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => onComplete?.()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Önizlemeye geç
            <ArrowRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setCurrentStep((s) => Math.min(steps.length, s + 1))}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            İleri
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function deriveSteps(template: DraftTemplate): number[] {
  const set = new Set<number>();
  for (const q of template.questions) set.add(q.step);
  return Array.from(set).sort((a, b) => a - b);
}

function isQuestionVisible(
  q: Question,
  answers: Record<string, unknown>,
): boolean {
  if (!q.dependsOn) return true;
  const actual = answers[q.dependsOn.questionId];
  if (q.dependsOn.equals !== undefined) return actual === q.dependsOn.equals;
  if (q.dependsOn.anyOf) return q.dependsOn.anyOf.includes(actual);
  return true;
}

function isEmpty(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0)
  );
}
