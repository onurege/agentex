"use client";

import { useRef, useState, useCallback } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { formatFileSize } from "@/lib/utils";

const QUALITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  good:    { label: "IYI",    color: "text-accent-success", bg: "bg-accent-success/10" },
  partial: { label: "KISMI", color: "text-accent-warning", bg: "bg-accent-warning/10" },
  poor:    { label: "ZAYIF",  color: "text-accent-danger",  bg: "bg-accent-danger/10" },
  none:    { label: "YOK",    color: "text-text-muted",     bg: "bg-workspace-bg/50" },
};

const PARSER_LABELS: Record<string, string> = {
  "mock-scenario": "Senaryo",
  "stub": "Stub",
  "plain-text": "TXT",
  "pdf": "PDF",
  "docx": "DOCX",
};

const ACCEPTED_TYPES = ".pdf,.docx,.txt";

/**
 * Real file upload control + document display with extraction intelligence.
 */
export function DocumentUpload() {
  const document = useWorkspaceStore((s) => s.job.document);
  const parsedDocument = useWorkspaceStore((s) => s.job.parsedDocument);
  const inputSource = useWorkspaceStore((s) => s.job.inputSource);
  const ingestUploadedFile = useWorkspaceStore((s) => s.ingestUploadedFile);
  const status = useWorkspaceStore((s) => s.job.status);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingestionError, setIngestionError] = useState<string | null>(null);
  const [ingestionWarnings, setIngestionWarnings] = useState<string[]>([]);

  const isDisabled = status === "running";
  const isUploadSource = inputSource?.type === "upload";

  const handleFile = useCallback(
    async (file: File) => {
      if (isDisabled) return;
      setIsIngesting(true);
      setIngestionError(null);
      setIngestionWarnings([]);
      try {
        const result = await ingestUploadedFile(file);
        if (!result.success) {
          setIngestionError(result.error ?? "Dosya işlenemedi");
        }
        if (result.warnings.length > 0) {
          setIngestionWarnings(result.warnings);
        }
      } catch (err) {
        setIngestionError(
          err instanceof Error ? err.message : "Dosya yüklenemedi",
        );
      } finally {
        setIsIngesting(false);
      }
    },
    [ingestUploadedFile, isDisabled],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Hidden file input
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPTED_TYPES}
      onChange={handleInputChange}
      className="hidden"
      disabled={isDisabled}
    />
  );

  // If we have an uploaded document, show it with replace option
  if (document && isUploadSource) {
    const quality = parsedDocument?.metadata.extractionQuality;
    const qualityConf = quality ? QUALITY_CONFIG[quality] : null;
    const parserUsed = parsedDocument?.metadata.parserUsed;
    const parserLabel = parserUsed ? PARSER_LABELS[parserUsed] ?? parserUsed : null;
    const sectionCount = parsedDocument?.sections.length ?? 0;
    const clauseCount =
      parsedDocument?.sections.reduce(
        (sum, s) => sum + (s.clauses?.length ?? 0),
        0,
      ) ?? 0;

    return (
      <div className="space-y-1.5">
        {fileInput}
        <label className="text-2xs font-mono text-text-tertiary uppercase tracking-wider flex items-center gap-1">
          📄 YÜKLENEN BELGE
        </label>
        <div className="flex items-start gap-2.5 p-2.5 bg-workspace-elevated border border-accent-primary/20 rounded-lg shadow-soft">
          <div className="w-8 h-8 bg-accent-primary/10 border border-accent-primary/30 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-base">📄</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-medium text-text-primary truncate">
              {document.name}
            </p>
            <p className="text-2xs font-mono text-text-muted mt-0.5">
              {formatFileSize(document.size)}
              {document.pageCount ? ` · ${document.pageCount} syf` : ""}
            </p>

            {/* Extraction intelligence */}
            {parsedDocument && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {qualityConf && (
                  <span
                    className={`text-2xs font-mono px-1 py-px rounded ${qualityConf.bg} ${qualityConf.color} border border-current/10`}
                  >
                    {qualityConf.label}
                  </span>
                )}
                {parserLabel && (
                  <span className="text-2xs font-mono text-text-muted">
                    {parserLabel}
                  </span>
                )}
                {sectionCount > 0 && (
                  <span className="text-2xs font-mono text-text-muted">
                    {sectionCount} bölüm
                    {clauseCount > 0 ? ` · ${clauseCount} madde` : ""}
                  </span>
                )}
              </div>
            )}

            {/* Replace button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled}
              className="mt-1.5 text-2xs font-mono text-accent-primary hover:text-accent-primary/80 transition-colors disabled:opacity-40"
            >
              Değiştir
            </button>
          </div>
        </div>

        {/* Extraction warnings */}
        {quality === "poor" && (
          <p className="text-2xs font-mono text-accent-warning px-1">
            Metin çıkarım kalitesi düşük. Analiz sonuçları sınırlı olabilir.
          </p>
        )}
        {quality === "none" && (
          <p className="text-2xs font-mono text-accent-danger px-1">
            Bu dosyadan metin çıkarılamadı. Taranmış veya şifreli olabilir.
          </p>
        )}
      </div>
    );
  }

  // If we have a scenario document, show read-only display
  if (document && !isUploadSource) {
    const quality = parsedDocument?.metadata.extractionQuality;
    const qualityConf = quality ? QUALITY_CONFIG[quality] : null;
    const sectionCount = parsedDocument?.sections.length ?? 0;
    const clauseCount =
      parsedDocument?.sections.reduce(
        (sum, s) => sum + (s.clauses?.length ?? 0),
        0,
      ) ?? 0;

    return (
      <div className="space-y-1.5">
        <label className="text-2xs font-mono text-text-tertiary uppercase tracking-wider flex items-center gap-1">
          📄 SÖZLEŞME BELGESİ
        </label>
        <div className="flex items-start gap-2.5 p-2.5 bg-workspace-elevated border border-accent-primary/20 rounded-lg shadow-soft">
          <div className="w-8 h-8 bg-accent-primary/10 border border-accent-primary/30 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-base">📄</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-medium text-text-primary truncate">
              {document.name}
            </p>
            <p className="text-2xs font-mono text-text-muted mt-0.5">
              {formatFileSize(document.size)}
              {document.pageCount ? ` · ${document.pageCount} syf` : ""}
            </p>
            {parsedDocument && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {qualityConf && (
                  <span
                    className={`text-2xs font-mono px-1 py-px rounded ${qualityConf.bg} ${qualityConf.color} border border-current/10`}
                  >
                    {qualityConf.label}
                  </span>
                )}
                <span className="text-2xs font-mono text-text-muted">Senaryo</span>
                {sectionCount > 0 && (
                  <span className="text-2xs font-mono text-text-muted">
                    {sectionCount} bölüm
                    {clauseCount > 0 ? ` · ${clauseCount} madde` : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No document yet — show upload drop zone
  return (
    <div className="space-y-1.5">
      {fileInput}
      <label className="text-2xs font-mono text-text-tertiary uppercase tracking-wider flex items-center gap-1">
        📄 BELGE YÜKLE
      </label>
      <button
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={isDisabled || isIngesting}
        className={`
          w-full flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg
          transition-all cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed
          ${isDragOver
            ? "border-accent-primary bg-accent-primary/10"
            : "border-workspace-border hover:border-accent-primary/40 hover:bg-accent-primary/5"
          }
        `}
      >
        {isIngesting ? (
          <>
            <span className="text-lg animate-pulse">📄</span>
            <p className="text-2xs font-mono text-text-muted">
              İşleniyor...
            </p>
          </>
        ) : (
          <>
            <span className="text-lg">📂</span>
            <p className="text-2xs font-mono text-text-secondary">
              Dosya seçin veya sürükleyin
            </p>
            <p className="text-2xs font-mono text-text-muted">
              PDF, DOCX veya TXT
            </p>
          </>
        )}
      </button>

      {ingestionError && (
        <p className="text-2xs font-mono text-accent-danger px-1">
          {ingestionError}
        </p>
      )}
      {ingestionWarnings.length > 0 && (
        <div className="space-y-0.5 px-1">
          {ingestionWarnings.map((w, i) => (
            <p key={i} className="text-2xs font-mono text-accent-warning">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
