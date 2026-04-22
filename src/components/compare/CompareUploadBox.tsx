"use client";

// ============================================================
// CompareUploadBox
// ============================================================
//
// Single-file dropzone specialized for the compare flow. Captures
// file metadata only (Faz 1 works on mock results — real parsing
// lands in Faz 2). Emits a CompareDocumentMeta when a file is
// picked; parent owns the "both uploaded?" decision.
// ============================================================

import { useCallback, useRef, useState, type DragEvent } from "react";
import { FileText, X, Upload } from "lucide-react";
import type { CompareDocumentMeta } from "@/lib/compare/types";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

interface CompareUploadBoxProps {
  label: string;
  tone: "v1" | "v2";
  meta: CompareDocumentMeta | null;
  onPick(meta: CompareDocumentMeta): void;
  onClear(): void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TONE_CLASSES = {
  v1: {
    label: "text-accent-info",
    ring: "ring-accent-info/20",
    chip: "bg-accent-info/10 text-accent-info border-accent-info/25",
  },
  v2: {
    label: "text-accent-primary",
    ring: "ring-accent-primary/20",
    chip: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
  },
} as const;

export function CompareUploadBox({
  label,
  tone,
  meta,
  onPick,
  onClear,
}: CompareUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const t = TONE_CLASSES[tone];

  const accept = useCallback(
    (file: File) => {
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) return;
      onPick({
        fileName: file.name,
        sizeBytes: file.size,
        parsedAt: new Date().toISOString(),
      });
    },
    [onPick],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) accept(file);
    },
    [accept],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative rounded-2xl border-2 border-dashed p-8 min-h-[260px] flex flex-col items-center justify-center transition-all
        ${
          dragging
            ? `border-accent-primary bg-accent-primary/5 ring-2 ${t.ring}`
            : meta
              ? "border-workspace-border bg-workspace-surface"
              : "border-workspace-border bg-workspace-elevated hover:border-accent-primary/40 hover:bg-workspace-surface"
        }`}
    >
      <div
        className={`absolute top-4 left-4 text-[11px] font-mono font-semibold tracking-widest uppercase ${t.label}`}
      >
        {label}
      </div>

      {meta ? (
        <div className="flex flex-col items-center text-center gap-3 w-full pt-4">
          <div
            className={`w-14 h-14 rounded-xl border ${t.chip} flex items-center justify-center`}
          >
            <FileText size={24} />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-text-primary break-all max-w-[280px]">
              {meta.fileName}
            </p>
            <p className="text-sm text-text-tertiary mt-0.5">
              {formatSize(meta.sizeBytes)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
          >
            <X size={14} />
            Kaldır
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-3 text-center w-full"
        >
          <div className="w-14 h-14 rounded-xl border border-workspace-border bg-workspace-surface flex items-center justify-center">
            <Upload size={22} className="text-text-secondary" />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-text-primary">
              Dosya yükle
            </p>
            <p className="text-sm text-text-tertiary mt-0.5">
              Sürükleyip bırakın veya tıklayın
            </p>
            <p className="text-xs text-text-muted mt-1 font-mono">
              {ACCEPTED_EXTENSIONS.join(" · ")}
            </p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) accept(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
