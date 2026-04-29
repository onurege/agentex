"use client";

// ============================================================
// WizardShell — Step bazlı soru-cevap yöneticisi
// ============================================================
//
// Template'in questions dizisini step numarasına göre gruplar,
// aktif adımda görünür (dependsOn matched) soruları render eder
// ve Geri / İleri navigasyonunu yönetir. Son adımda "Kurula
// Gönder" CTA'sı açılır: ajan seçimi modal'ı + DOCX export +
// boardroom flow store'una otomatik ingest + /app/setup'a
// yönlendirme zincirini tetikler.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import type { DraftTemplate, Question } from "@/lib/draft/types";
import { useDraftStore } from "@/lib/draft/store";
import { evaluateWarnings } from "@/lib/draft/warnings";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { WarningBanner } from "./WarningBanner";
import { WizardQuestion } from "./WizardQuestion";
import { BoardPickerModal } from "./BoardPickerModal";

interface WizardShellProps {
  template: DraftTemplate;
  sessionId: string;
}

export function WizardShell({
  template,
  sessionId,
}: WizardShellProps) {
  const router = useRouter();
  const session = useDraftStore((s) => s.getSession(sessionId));
  const updateAnswer = useDraftStore((s) => s.updateAnswer);
  const setDraftStatus = useDraftStore((s) => s.setStatus);

  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const steps = useMemo(() => deriveSteps(template), [template]);
  const [currentStep, setCurrentStep] = useState(1);
  const answers = session?.answers ?? {};

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

  const visibleQuestions = template.questions
    .filter((q) => q.step === currentStep)
    .filter((q) => isQuestionVisible(q, answers));

  const groupName = visibleQuestions[0]?.group ?? "Sorular";
  const isLastStep = currentStep === steps.length;

  const canAdvance = visibleQuestions.every((q) => {
    if (!q.required) return true;
    const v = answers[q.id];
    return !isEmpty(v);
  });

  const activeWarnings = evaluateWarnings(template, answers);

  const sendToBoard = useCallback(
    async (agentIds: string[]) => {
      if (!session) return;
      setSending(true);
      setSendError(null);
      try {
        const res = await fetch("/api/draft/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: session.templateId,
            sessionId: session.id,
            answers: session.answers,
            aiAccepted: session.aiAccepted,
            disabledClauses: session.disabledClauses,
          }),
        });
        if (!res.ok) {
          let message = `Sunucu hatası (${res.status})`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body?.error) message = body.error;
          } catch {
            // non-JSON — fall through with status code
          }
          throw new Error(message);
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const fileName =
          extractFilename(disposition) ??
          `${template.label}-${new Date().toISOString().slice(0, 10)}.docx`;
        const file = new File([blob], fileName, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        const flow = useBoardroomFlowStore.getState();
        flow.setSelectedAgentIds(agentIds);
        flow.setContextNotes(
          `Sıfırdan üretilen ${template.label} taslağı (draft:${session.id}).`,
        );
        await flow.ingestFile(file);

        const finalStatus = useBoardroomFlowStore.getState().uploadStatus;
        if (finalStatus !== "success") {
          const msg =
            useBoardroomFlowStore.getState().uploadError ??
            "Kurula yükleme başarısız.";
          throw new Error(msg);
        }

        setDraftStatus(session.id, "complete");
        setShowBoardPicker(false);
        router.push("/app/setup");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Kurula gönderilemedi.";
        setSendError(msg);
        setSending(false);
      }
    },
    [session, template, router, setDraftStatus],
  );

  if (!session) return null;

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
            templateId={template.id}
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
            disabled={!canAdvance || sending}
            onClick={() => setShowBoardPicker(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={15} />
            Kurula Gönder
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

      <BoardPickerModal
        open={showBoardPicker}
        working={sending}
        error={sendError}
        onClose={() => {
          if (sending) return;
          setShowBoardPicker(false);
          setSendError(null);
        }}
        onConfirm={(ids) => void sendToBoard(ids)}
      />
    </div>
  );
}

function extractFilename(disposition: string): string | null {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf) return decodeURIComponent(utf[1]);
  const ascii = /filename="([^"]+)"/i.exec(disposition);
  if (ascii) return ascii[1];
  return null;
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
