"use client";

// ============================================================
// WizardQuestion — Soru tipine göre input render'ı
// ============================================================
//
// Question.type değerine göre doğru kontrolü çizer. Değer
// değişimi onChange üzerinden yukarı akar; validasyon/store'a
// yazma WizardShell tarafında yapılır.
// ============================================================

import { useId } from "react";
import type { Question } from "@/lib/draft/types";

interface WizardQuestionProps {
  question: Question;
  value: unknown;
  onChange(value: unknown): void;
}

export function WizardQuestion({
  question,
  value,
  onChange,
}: WizardQuestionProps) {
  const uid = useId();
  const inputId = `q-${uid}-${question.id}`;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-text-primary"
        >
          {question.label}
          {question.required && (
            <span className="ml-1 text-accent-danger" aria-label="zorunlu">
              *
            </span>
          )}
        </label>
      </div>
      {question.helpText && (
        <p className="text-xs text-text-tertiary leading-relaxed">
          {question.helpText}
        </p>
      )}
      <div>{renderInput(question, inputId, value, onChange)}</div>
    </div>
  );
}

function renderInput(
  q: Question,
  inputId: string,
  value: unknown,
  onChange: (v: unknown) => void,
) {
  const base =
    "w-full rounded-lg border border-workspace-border bg-workspace-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/40 transition-colors";

  switch (q.type) {
    case "text":
      return (
        <input
          id={inputId}
          type="text"
          className={base}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          pattern={q.validation?.pattern}
        />
      );

    case "longText":
      return (
        <textarea
          id={inputId}
          className={`${base} min-h-[96px] resize-y leading-relaxed`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          id={inputId}
          type="number"
          className={base}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
          min={q.validation?.min}
          max={q.validation?.max}
        />
      );

    case "currency":
      return (
        <div className="relative">
          <input
            id={inputId}
            type="number"
            className={`${base} pr-12`}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
            min={q.validation?.min ?? 0}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-text-tertiary">
            TL
          </span>
        </div>
      );

    case "date":
      return (
        <input
          id={inputId}
          type="date"
          className={base}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select":
      return (
        <select
          id={inputId}
          className={base}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Seçin…
          </option>
          {q.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "radioGroup":
      return (
        <ul className="space-y-2">
          {q.options?.map((opt) => {
            const selected = value === opt.value;
            return (
              <li key={opt.value}>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${
                      selected
                        ? "border-accent-primary bg-accent-primary/5"
                        : "border-workspace-border bg-workspace-surface hover:border-accent-primary/30"
                    }`}
                >
                  <input
                    type="radio"
                    name={inputId}
                    value={opt.value}
                    checked={selected}
                    onChange={() => onChange(opt.value)}
                    className="mt-0.5 accent-accent-primary"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      );

    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-accent-primary h-4 w-4"
          />
          <span className="text-sm text-text-secondary">
            {value ? "Evet" : "Hayır"}
          </span>
        </label>
      );

    case "multiCheckbox": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <ul className="space-y-2">
          {q.options?.map((opt) => {
            const checked = arr.includes(opt.value);
            return (
              <li key={opt.value}>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${
                      checked
                        ? "border-accent-primary bg-accent-primary/5"
                        : "border-workspace-border bg-workspace-surface hover:border-accent-primary/30"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...arr, opt.value]
                        : arr.filter((v) => v !== opt.value);
                      onChange(next);
                    }}
                    className="mt-0.5 accent-accent-primary"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      );
    }

    default:
      return null;
  }
}
