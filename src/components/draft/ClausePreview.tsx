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

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import type { DraftSession, DraftTemplate } from "@/lib/draft/types";
import { renderDraft } from "@/lib/draft/renderer";
import { useDraftStore } from "@/lib/draft/store";
import { ClauseToggle } from "./ClauseToggle";
import { AISuggestBox } from "./AISuggestBox";

interface ClausePreviewProps {
  template: DraftTemplate;
  session: DraftSession;
}

export function ClausePreview({ template, session }: ClausePreviewProps) {
  const { clauses, missingByClause } = renderDraft(template, session);
  const toggleClause = useDraftStore((s) => s.toggleClause);
  const setStatus = useDraftStore((s) => s.setStatus);
  const setManualEdit = useDraftStore((s) => s.setManualEdit);
  const clearManualEdit = useDraftStore((s) => s.clearManualEdit);
  const manualEdits = session.manualEdits ?? {};

  const [exportState, setExportState] = useState<"idle" | "working" | "error">(
    "idle",
  );
  const [exportError, setExportError] = useState<string | null>(null);

  // Kullanıcının aç/kapa yapabildiği opsiyonel maddeler:
  // defaultEnabled=true + gate yok. Gate'li olanlar wizard cevabına tabi.
  const togglableClauses = template.clauses.filter((c) => {
    if (c.required) return false;
    if (!c.defaultEnabled) return false;
    return true;
  });

  // aiEditable clause id'lerini hızlı erişim için set'te tutuyoruz.
  const aiEditableSet = useMemo(
    () =>
      new Set(
        template.clauses
          .filter((c) => c.aiEditable)
          .map((c) => c.id),
      ),
    [template],
  );

  const hasMissing = Object.keys(missingByClause).length > 0;

  const handleExport = useCallback(async () => {
    setExportState("working");
    setExportError(null);
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
          manualEdits: session.manualEdits ?? {},
        }),
      });

      if (!res.ok) {
        let msg = `Sunucu hatası (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) msg = body.error;
        } catch {
          // non-JSON response — fall through
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fileName =
        extractFilename(disposition) ??
        `${template.label}-${new Date().toISOString().slice(0, 10)}.docx`;
      triggerDownload(blob, fileName);
      setStatus(session.id, "complete");
      setExportState("idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DOCX oluşturulamadı.";
      setExportState("error");
      setExportError(msg);
    }
  }, [
    session.templateId,
    session.id,
    session.answers,
    session.aiAccepted,
    session.disabledClauses,
    session.manualEdits,
    setStatus,
    template.label,
  ]);

  const canExport = clauses.length > 0 && exportState !== "working";

  return (
    <div className="flex flex-col gap-4">
      {/* Export action */}
      <div className="flex flex-col items-stretch gap-1.5">
        <button
          type="button"
          disabled={!canExport}
          onClick={handleExport}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
            canExport
              ? "bg-accent-primary text-workspace-surface border-accent-primary hover:bg-accent-secondary shadow-medium"
              : "bg-workspace-elevated text-text-tertiary border-workspace-border cursor-not-allowed opacity-70"
          }`}
        >
          {exportState === "working" ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              DOCX hazırlanıyor…
            </>
          ) : (
            <>
              <Download size={15} />
              DOCX İndir
            </>
          )}
        </button>
        {hasMissing && exportState !== "error" && (
          <p className="text-xs text-text-tertiary text-center">
            Eksik alanlar DOCX&apos;te{" "}
            <span className="text-accent-danger font-mono">[ … ]</span> olarak
            kalır; yine de indirebilirsiniz.
          </p>
        )}
        {exportState === "error" && exportError && (
          <p className="text-xs text-accent-danger text-center">
            {exportError}
          </p>
        )}
      </div>

      {hasMissing && (
        <div className="rounded-lg border border-accent-warning/30 bg-accent-warning/[0.06] px-4 py-3 text-[15px] leading-relaxed text-text-secondary">
          <span className="font-semibold text-accent-warning">Eksik alan:</span>{" "}
          Bazı maddelerde doldurulmamış cevaplar var. Sözleşme metninde{" "}
          <span className="text-accent-danger font-mono">[ … ]</span> işaretleri
          ilgili yerleri vurguluyor.
        </div>
      )}

      <article className="rounded-xl border border-workspace-border bg-workspace-surface shadow-sm">
        <header className="px-7 py-6 border-b border-workspace-border text-center">
          <h2 className="font-display text-2xl font-bold tracking-wide text-text-primary uppercase">
            {template.documentTitle}
          </h2>
        </header>

        <div className="px-7 py-7 space-y-7">
          {clauses.length === 0 ? (
            <p className="text-base text-text-tertiary text-center py-4">
              Soruları doldurdukça madde metinleri burada şekillenecek.
            </p>
          ) : (
            clauses.map((c) => {
              const edit = manualEdits[c.clauseId];
              const isEdited =
                edit?.title !== undefined || edit?.body !== undefined;
              return (
                <section key={c.clauseId}>
                  <EditableClause
                    number={c.number}
                    title={c.title}
                    body={c.body}
                    isEdited={isEdited}
                    onEditTitle={(next) =>
                      setManualEdit(session.id, c.clauseId, "title", next)
                    }
                    onEditBody={(next) =>
                      setManualEdit(session.id, c.clauseId, "body", next)
                    }
                    onReset={() => clearManualEdit(session.id, c.clauseId)}
                  />
                  {aiEditableSet.has(c.clauseId) && !isEdited && (
                    <div className="mt-2">
                      <AISuggestBox
                        templateId={template.id}
                        clauseId={c.clauseId}
                        clauseTitle={c.title}
                        session={session}
                      />
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </article>

      {togglableClauses.length > 0 && (
        <section className="rounded-xl border border-workspace-border bg-workspace-elevated p-4">
          <h3 className="font-display text-base font-semibold text-text-primary mb-2">
            Opsiyonel Maddeler
          </h3>
          <p className="text-[14px] text-text-tertiary leading-relaxed mb-3">
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

function extractFilename(disposition: string): string | null {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf) return decodeURIComponent(utf[1]);
  const ascii = /filename="([^"]+)"/i.exec(disposition);
  if (ascii) return ascii[1];
  return null;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// EditableClause — başlık ve gövdeyi contentEditable olarak çizer.
// Otomatik madde numarası kilitli (select-none span). Kullanıcı yapıştırma
// yaparken plain-text'e düşürürüz; aksi takdirde format kalıntıları
// DOCX export'a kaçar. Reset olunca DOM textContent'i prop ile hizalanır
// (contentEditable + React'in birlikte çalışmaması için elle sync).
function EditableClause({
  number,
  title,
  body,
  isEdited,
  onEditTitle,
  onEditBody,
  onReset,
}: {
  number: string;
  title: string;
  body: string;
  isEdited: boolean;
  onEditTitle: (next: string) => void;
  onEditBody: (next: string) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="font-display text-[17px] font-semibold text-text-primary leading-snug">
          <span className="select-none">{number} — </span>
          <EditableText
            value={title}
            onCommit={onEditTitle}
            ariaLabel="Madde başlığı"
            className="outline-none focus:bg-accent-primary/[0.06] rounded px-0.5 -mx-0.5"
          />
        </h3>
        {isEdited && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide text-accent-warning hover:text-text-primary transition-colors shrink-0"
            title="Bu maddedeki manuel düzenlemeyi sıfırla — şablon metnine geri dön."
          >
            <RotateCcw size={11} />
            Düzenlendi · sıfırla
          </button>
        )}
      </div>
      <EditableText
        value={body}
        onCommit={onEditBody}
        multiline
        ariaLabel="Madde gövdesi"
        className="block text-[16px] text-text-secondary leading-8 whitespace-pre-wrap outline-none focus:bg-accent-primary/[0.04] rounded px-1 -mx-1 py-0.5"
        renderInitial={(text) => renderBodyWithHighlights(text)}
      />
    </>
  );
}

// EditableText — contentEditable + React arasındaki çatışmayı yöneten
// minimal sarmalayıcı. Prop değeri değiştiğinde, DOM textContent'i
// odakta değilse hizalanır (kullanıcı yazarken DOM'u patlatmıyoruz).
function EditableText({
  value,
  onCommit,
  ariaLabel,
  className,
  multiline = false,
  renderInitial,
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  className: string;
  multiline?: boolean;
  /**
   * İlk render'da gösterilecek zenginleştirilmiş içerik (örn. eksik
   * cevap badge'leri). Düzenleme başlayınca DOM textContent ile
   * sürekli hale geliriz; bu yüzden zengin görünüm yalnızca odaklanmadan
   * önceki ilk render için geçerli.
   */
  renderInitial?: (text: string) => React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      aria-label={ariaLabel}
      spellCheck
      className={className}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      onBlur={(e) => {
        const next = e.currentTarget.textContent ?? "";
        if (next !== value) onCommit(next);
      }}
    >
      {renderInitial ? renderInitial(value) : value}
    </span>
  );
}

const INLINE_MARKUP_RE = /(\[ [^\]]+ \]|\*\*[^*]+\*\*)/g;

function renderBodyWithHighlights(body: string) {
  const parts = body.split(INLINE_MARKUP_RE);
  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 12)}`;
    if (/^\[ [^\]]+ \]$/.test(part)) {
      return (
        <span
          key={key}
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent-danger/10 text-accent-danger text-[13px] font-mono mx-0.5 align-middle"
        >
          {part}
        </span>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={key} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}
