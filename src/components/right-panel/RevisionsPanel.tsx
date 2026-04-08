"use client";

import { useState, useCallback } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { ArrowRight, Download } from "lucide-react";
import { downloadRedlineDocx } from "@/lib/export/docx-redline";
import { downloadPatchedDocx } from "@/lib/export/docx-patch";
import { getCachedDocxBuffer } from "@/lib/export/docx-cache";

const PRIORITY_LABELS: Record<string, string> = {
  high: "yüksek",
  medium: "orta",
  low: "düşük",
};

export function RevisionsPanel() {
  const revisions = useWorkspaceStore((s) => s.job.revisionSuggestions);
  const document = useWorkspaceStore((s) => s.job.document);
  const jobTitle = useWorkspaceStore((s) => s.job.title);
  const inputSource = useWorkspaceStore((s) => s.job.inputSource);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Determine if we can do in-place DOCX patching
  const isDocxSource =
    inputSource?.type === "upload" &&
    document?.type === "docx" &&
    getCachedDocxBuffer() !== null;

  const handleExport = useCallback(async () => {
    if (revisions.length === 0 || isExporting) return;
    setIsExporting(true);
    setExportStatus(null);

    try {
      if (isDocxSource) {
        // In-place DOCX patching
        const cached = getCachedDocxBuffer()!;
        const result = await downloadPatchedDocx(
          cached.buffer,
          cached.fileName,
          revisions,
        );

        const fallbackCount = result.unmatched + result.ambiguous;
        if (fallbackCount > 0) {
          const parts = [`${result.matched}/${revisions.length} revizyon belgede uygulandı`];
          if (result.ambiguous > 0) {
            parts.push(`${result.ambiguous} belirsiz eşleşme atlandı`);
          }
          if (result.unmatched > 0) {
            parts.push(`${result.unmatched} bulunamadı`);
          }
          parts.push("— belge sonuna eklendi");
          setExportStatus(parts.join(", "));
        } else {
          setExportStatus(
            `${result.matched} revizyon belgede başarıyla uygulandı.`,
          );
        }
      } else {
        // Report-style export (non-DOCX sources)
        await downloadRedlineDocx({
          title: `${jobTitle} — Revizyon Raporu`,
          fileName: document?.name,
          revisions,
        });
        setExportStatus(null);
      }
    } catch (err) {
      console.error("DOCX export failed:", err);
      setExportStatus("Dışa aktarma başarısız oldu.");
    } finally {
      setIsExporting(false);
    }
  }, [revisions, document, jobTitle, isExporting, isDocxSource]);

  if (revisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm text-text-secondary">Henüz revizyon yok</p>
        <p className="text-xs text-text-muted mt-1">
          Önerilen sözleşme revizyonları burada görünecek
        </p>
      </div>
    );
  }

  const exportLabel = isDocxSource
    ? "Revizyonlu DOCX İndir"
    : "Revizyon Raporu İndir";

  const exportHint = isDocxSource
    ? "Orijinal belge üzerinde kırmızı/yeşil değişiklikler"
    : "Ayrı revizyon raporu belgesi";

  return (
    <div className="p-3 space-y-3">
      {/* Export button */}
      <div className="space-y-1">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono
            bg-accent-primary/10 border border-accent-primary/30 rounded-lg
            text-accent-primary hover:bg-accent-primary/20 transition-all
            disabled:opacity-50 disabled:cursor-wait"
        >
          <Download size={13} />
          {isExporting ? "Hazırlanıyor..." : exportLabel}
        </button>
        <p className="text-2xs font-mono text-text-muted text-center">
          {exportHint}
        </p>
        {exportStatus && (
          <p className="text-2xs font-mono text-accent-primary text-center px-1">
            {exportStatus}
          </p>
        )}
      </div>

      {/* Revisions list */}
      {revisions.map((rev) => {
        const agent = AGENTS[rev.agentId];

        return (
          <div
            key={rev.id}
            className="rounded-lg border border-workspace-border-subtle overflow-hidden"
          >
            {/* Başlık */}
            <div className="px-3 py-2 bg-workspace-elevated flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs">{agent?.avatar}</span>
                <span className="text-2xs font-medium text-text-secondary">
                  {agent?.shortName}
                </span>
                <span className="text-2xs text-text-muted">·</span>
                <span className="text-2xs text-text-muted">{rev.section}</span>
              </div>
              <span
                className={`badge ${
                  rev.priority === "high"
                    ? "badge-critical"
                    : rev.priority === "medium"
                    ? "badge-warning"
                    : "badge-info"
                }`}
              >
                {PRIORITY_LABELS[rev.priority] ?? rev.priority}
              </span>
            </div>

            {/* İçerik */}
            <div className="p-3 space-y-3">
              {/* Mevcut metin */}
              <div>
                <p className="text-2xs font-medium text-accent-danger/70 uppercase tracking-wider mb-1">
                  Mevcut Metin
                </p>
                <div className="px-2.5 py-2 rounded-md bg-accent-danger/5 border border-accent-danger/10">
                  <p className="text-xs text-text-secondary leading-relaxed font-mono">
                    {rev.currentText}
                  </p>
                </div>
              </div>

              {/* Ok */}
              <div className="flex items-center justify-center">
                <ArrowRight size={14} className="text-accent-success rotate-90" />
              </div>

              {/* Önerilen metin */}
              <div>
                <p className="text-2xs font-medium text-accent-success/70 uppercase tracking-wider mb-1">
                  Önerilen Metin
                </p>
                <div className="px-2.5 py-2 rounded-md bg-accent-success/5 border border-accent-success/10">
                  <p className="text-xs text-text-secondary leading-relaxed font-mono">
                    {rev.suggestedText}
                  </p>
                </div>
              </div>

              {/* Gerekçe */}
              <div className="pt-1">
                <p className="text-2xs font-medium text-text-muted uppercase tracking-wider mb-1">
                  Gerekçe
                </p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {rev.rationale}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
