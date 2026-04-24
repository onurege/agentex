"use client";

// ============================================================
// ClausePreview — Canlı sözleşme önizlemesi
// ============================================================
//
// renderDraft çıktısını doküman görünümünde çizer. Eksik
// answer'lar [ Etiket ] işareti ile kırmızı vurgulanır. Altta
// opsiyonel maddeleri aç/kapa listesi; gate'li opsiyoneller
// (hasPenalty → Cezai Şart, hasNonCompete → Rekabet Yasağı)
// wizard cevaplarından türediği için burada toggle edilmez.
// ============================================================

import { Fragment } from "react";
import type { DraftSession, DraftTemplate } from "@/lib/draft/types";
import { renderDraft } from "@/lib/draft/renderer";
import { useDraftStore } from "@/lib/draft/store";
import { ClauseToggle } from "./ClauseToggle";

interface ClausePreviewProps {
  template: DraftTemplate;
  session: DraftSession;
}

export function ClausePreview({ template, session }: ClausePreviewProps) {
  const { clauses, missingByClause } = renderDraft(template, session);
  const toggleClause = useDraftStore((s) => s.toggleClause);

  // Kullanıcının aç/kapa yapabildiği opsiyonel maddeler:
  // defaultEnabled=true + gate yok. Gate'li olanlar wizard cevabına tabi.
  const togglableClauses = template.clauses.filter((c) => {
    if (c.required) return false;
    if (!c.defaultEnabled) return false;
    return true;
  });

  const hasMissing = Object.keys(missingByClause).length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasMissing && (
        <div className="rounded-lg border border-accent-warning/30 bg-accent-warning/[0.06] px-4 py-3 text-sm text-text-secondary">
          <span className="font-semibold text-accent-warning">Eksik alan:</span>{" "}
          Bazı maddelerde doldurulmamış cevaplar var. Sözleşme metninde{" "}
          <span className="text-accent-danger font-mono">[ … ]</span> işaretleri
          ilgili yerleri vurguluyor.
        </div>
      )}

      <article className="rounded-xl border border-workspace-border bg-workspace-surface shadow-sm">
        <header className="px-6 py-5 border-b border-workspace-border text-center">
          <h2 className="font-display text-xl font-bold tracking-wide text-text-primary uppercase">
            {template.documentTitle}
          </h2>
        </header>

        <div className="px-6 py-6 space-y-5">
          {clauses.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-4">
              Soruları doldurdukça madde metinleri burada şekillenecek.
            </p>
          ) : (
            clauses.map((c) => (
              <section key={c.clauseId}>
                <h3 className="font-display text-sm font-semibold text-text-primary mb-1.5">
                  {c.number} — {c.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {renderBodyWithHighlights(c.body)}
                </p>
              </section>
            ))
          )}
        </div>
      </article>

      {togglableClauses.length > 0 && (
        <section className="rounded-xl border border-workspace-border bg-workspace-elevated p-4">
          <h3 className="font-display text-sm font-semibold text-text-primary mb-2">
            Opsiyonel Maddeler
          </h3>
          <p className="text-xs text-text-tertiary mb-3">
            Bu maddeleri sözleşmeden çıkarabilirsiniz. Kritik koşullarda
            hukuki risk doğurabilir — kararsızsanız avukatınıza danışın.
          </p>
          <ul className="space-y-2">
            {togglableClauses.map((c) => {
              const enabled = !session.disabledClauses.includes(c.id);
              return (
                <li key={c.id}>
                  <ClauseToggle
                    clause={c}
                    enabled={enabled}
                    onChange={(next) =>
                      toggleClause(session.id, c.id, next)
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

const MISSING_RE = /(\[ [^\]]+ \])/g;

function renderBodyWithHighlights(body: string) {
  const parts = body.split(MISSING_RE);
  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 12)}`;
    if (MISSING_RE.test(part)) {
      // Reset lastIndex for the shared /g regex — .test advances it.
      MISSING_RE.lastIndex = 0;
      return (
        <span
          key={key}
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent-danger/10 text-accent-danger text-xs font-mono mx-0.5 align-middle"
        >
          {part}
        </span>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}
