"use client";

import { useCallback, useState } from "react";
import { Check, Download, FileText, Loader2, Save, SquarePlus } from "lucide-react";
import { useDraftPromptStore } from "@/lib/draft-prompt/store";
import type { PromptDraftSession } from "@/lib/draft-prompt/types";
import { EditableText } from "./EditableText";

interface Props {
  session: PromptDraftSession;
  /** Sağ üstte ekstra aksiyon butonları (kaydet vs.). */
  toolbarExtras?: React.ReactNode;
  /** Sahibi olmayan grup üyesi için preview read-only. */
  readOnly?: boolean;
}

export function PromptDraftPreview({
  session,
  toolbarExtras,
  readOnly = false,
}: Props) {
  const updateTitle = useDraftPromptStore((s) => s.updateTitle);
  const updatePreamble = useDraftPromptStore((s) => s.updatePreamble);
  const updateClosing = useDraftPromptStore((s) => s.updateClosing);
  const updateClauseBody = useDraftPromptStore((s) => s.updateClauseBody);
  const updateClauseHeading = useDraftPromptStore((s) => s.updateClauseHeading);

  const [exportState, setExportState] = useState<"idle" | "working" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  const draft = session.draft;

  const handleExport = useCallback(async () => {
    if (!draft) return;
    setExportState("working");
    setExportError(null);
    try {
      const res = await fetch("/api/draft/prompt/export", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        let msg = `Sunucu hatası (${res.status})`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) msg = body.message;
        } catch {
          // non-JSON
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fileName =
        extractFilename(disposition) ??
        `${draft.title || "sozlesme"}-${new Date().toISOString().slice(0, 10)}.docx`;
      triggerDownload(blob, fileName);
      setExportState("idle");
    } catch (err) {
      setExportState("error");
      setExportError(err instanceof Error ? err.message : "DOCX üretilemedi.");
    }
  }, [draft]);

  if (!draft) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 text-text-tertiary">
        <FileText size={32} className="mb-3 text-text-tertiary/70" />
        <p className="text-base font-medium text-text-primary mb-1">
          Taslak henüz yok
        </p>
        <p className="text-sm max-w-md">
          Soldaki sohbete sözleşmenizi tarif edin. AI taslağı bu alanda canlı
          olarak hazırlayacak; sonra her satırı doğrudan tıklayıp
          düzenleyebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-workspace-border/60 bg-workspace-surface/60 backdrop-blur-sm">
        <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
          {draft.clauses.length} madde
          {session.status === "generating" && (
            <span className="ml-3 inline-flex items-center gap-1 text-accent-primary">
              <Loader2 size={11} className="animate-spin" />
              Güncelleniyor
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exportState === "error" && exportError && (
            <span className="text-xs text-accent-danger truncate max-w-[200px]" title={exportError}>
              {exportError}
            </span>
          )}
          {toolbarExtras}
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exportState === "working"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {exportState === "working" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            DOCX İndir
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <article className="mx-auto max-w-3xl px-10 py-10 text-text-primary">
          <EditableText
            as="div"
            value={draft.title}
            onCommit={(next) => updateTitle(session.id, next)}
            ariaLabel="Sözleşme başlığı"
            readOnly={readOnly}
            className="font-display text-2xl md:text-3xl font-bold text-center leading-tight tracking-tight outline-none focus:bg-accent-primary/[0.04] rounded px-2 py-1"
          />

          <EditableText
            as="div"
            value={draft.preamble}
            onCommit={(next) => updatePreamble(session.id, next)}
            ariaLabel="Taraflar paragrafı"
            multiline
            placeholder="Taraflar paragrafı"
            readOnly={readOnly}
            className="mt-8 text-[15px] leading-[1.8] text-justify whitespace-pre-wrap outline-none focus:bg-accent-primary/[0.04] rounded px-2 py-1.5"
          />

          <div className="mt-8 space-y-6">
            {draft.clauses.map((clause, idx) => (
              <section key={clause.id}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-semibold text-text-primary text-[15px] shrink-0">
                    {idx + 1}.
                  </span>
                  <EditableText
                    as="div"
                    value={clause.heading}
                    onCommit={(next) =>
                      updateClauseHeading(session.id, clause.id, next)
                    }
                    ariaLabel={`Madde ${idx + 1} başlığı`}
                    readOnly={readOnly}
                    className="flex-1 font-semibold text-[15px] outline-none focus:bg-accent-primary/[0.04] rounded px-1.5 py-0.5"
                  />
                </div>
                <EditableText
                  as="div"
                  value={clause.body}
                  onCommit={(next) =>
                    updateClauseBody(session.id, clause.id, next)
                  }
                  ariaLabel={`Madde ${idx + 1} içeriği`}
                  multiline
                  readOnly={readOnly}
                  className="pl-5 text-[14px] leading-[1.75] text-justify whitespace-pre-wrap outline-none focus:bg-accent-primary/[0.04] rounded px-2 py-1.5"
                />
              </section>
            ))}
          </div>

          <EditableText
            as="div"
            value={draft.closing}
            onCommit={(next) => updateClosing(session.id, next)}
            ariaLabel="Kapanış paragrafı"
            multiline
            placeholder="Kapanış / imza alanı"
            readOnly={readOnly}
            className="mt-10 text-[15px] leading-[1.8] whitespace-pre-wrap outline-none focus:bg-accent-primary/[0.04] rounded px-2 py-1.5"
          />
        </article>
      </div>
    </div>
  );
}

function extractFilename(contentDisposition: string): string | null {
  const m = /filename\s*=\s*"?([^"]+)"?/i.exec(contentDisposition);
  return m?.[1] ?? null;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
