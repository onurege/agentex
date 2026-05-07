"use client";

import { useCallback, useRef, useState } from "react";
import { useBoardroomFlowStore, type UploadStatus } from "@/lib/boardroom-flow-store";
import { logClientActivity } from "@/lib/client-activity";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusLabel({ status, error }: { status: UploadStatus; error: string | null }) {
  switch (status) {
    case "uploading":
      return (
        <span className="flex items-center gap-2 text-base text-accent-primary">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-primary animate-pulse" />
          Dosya yükleniyor...
        </span>
      );
    case "parsing":
      return (
        <span className="flex items-center gap-2 text-base text-accent-primary">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-primary animate-pulse" />
          Belge işleniyor...
        </span>
      );
    case "success":
      return (
        <span className="flex items-center gap-2 text-base text-accent-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Belge hazır
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-2 text-base text-accent-danger">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error || "Belge okunamadı"}
        </span>
      );
    default:
      return null;
  }
}

export function DocumentUploadPanel() {
  const uploadedFile = useBoardroomFlowStore((s) => s.uploadedFile);
  const uploadStatus = useBoardroomFlowStore((s) => s.uploadStatus);
  const uploadError = useBoardroomFlowStore((s) => s.uploadError);
  const uploadWarnings = useBoardroomFlowStore((s) => s.uploadWarnings);
  const parsedDocument = useBoardroomFlowStore((s) => s.parsedDocument);
  const ingestFile = useBoardroomFlowStore((s) => s.ingestFile);
  const clearDocument = useBoardroomFlowStore((s) => s.clearDocument);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return; // silently ignore unsupported
      }
      void logClientActivity({
        action: "document_uploaded",
        targetType: "document",
        targetId: file.name,
        summary: `"${file.name}" kurul değerlendirmesi için yüklendi`,
        module: "boardroom",
        metadata: { fileName: file.name, fileSize: file.size, fileType: file.type },
      });
      await ingestFile(file);
    },
    [ingestFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so re-upload of same file works
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  const isProcessing = uploadStatus === "uploading" || uploadStatus === "parsing";
  const hasFile = uploadedFile !== null;

  return (
    <div className="flex flex-col">
      <h2 className="text-base font-semibold text-text-primary mb-2">
        Belge Yükle
      </h2>

      {/* Dropzone or File Card */}
      {!hasFile || uploadStatus === "error" ? (
        /* ── Dropzone ── */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center rounded-xl cursor-pointer
            border-2 border-dashed transition-all duration-200
            min-h-[160px] p-5
            ${
              isDragOver
                ? "border-accent-primary bg-accent-primary/5"
                : "border-workspace-border bg-workspace-surface/50 hover:border-accent-primary/40"
            }
          `}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted mb-2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm text-text-secondary">
            Dosyayı sürükleyin veya tıklayın
          </p>
          <p className="text-xs text-text-muted">PDF / DOCX / TXT</p>

          {/* Error re-upload hint */}
          {uploadStatus === "error" && (
            <div className="mt-4">
              <StatusLabel status={uploadStatus} error={uploadError} />
              <p className="text-sm text-text-muted mt-2">Farklı bir dosya deneyin.</p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      ) : (
        /* ── File Card ── */
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-accent-primary uppercase font-mono">
                {uploadedFile.name.split(".").pop()?.toUpperCase() ?? "?"}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {uploadedFile.name}
              </p>
              <p className="text-xs text-text-secondary">
                {formatFileSize(uploadedFile.size)}
                {parsedDocument?.pageCount
                  ? ` · ${parsedDocument.pageCount} sayfa`
                  : ""}
              </p>
            </div>

            {/* Remove button */}
            {!isProcessing && (
              <button
                onClick={clearDocument}
                className="flex items-center justify-center w-10 h-10 rounded-lg
                           text-text-muted hover:text-accent-danger hover:bg-accent-danger/10
                           transition-colors duration-150 shrink-0"
                title="Belgeyi kaldır"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Status */}
          <StatusLabel status={uploadStatus} error={uploadError} />

          {/* Warnings */}
          {uploadWarnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {uploadWarnings.map((w, i) => (
                <p key={i} className="text-sm text-accent-warning">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          {/* Parse quality info */}
          {parsedDocument?.metadata.extractionQuality && uploadStatus === "success" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[13px] font-mono text-text-muted uppercase">
                Çıkarma kalitesi:
              </span>
              <span
                className={`text-[13px] font-semibold ${
                  parsedDocument.metadata.extractionQuality === "good"
                    ? "text-accent-success"
                    : parsedDocument.metadata.extractionQuality === "partial"
                      ? "text-accent-warning"
                      : "text-accent-danger"
                }`}
              >
                {parsedDocument.metadata.extractionQuality === "good"
                  ? "İyi"
                  : parsedDocument.metadata.extractionQuality === "partial"
                    ? "Kısmi"
                    : "Düşük"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
