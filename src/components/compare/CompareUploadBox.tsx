"use client";

// ============================================================
// CompareUploadBox
// ============================================================
//
// Single-file dropzone specialized for the compare flow. Runs the
// picked file through the real ingestion pipeline (Faz 2), exposes
// idle/parsing/ready/error status inline, and emits a CompareUploadPayload
// carrying parsed sections plus — for DOCX — the original buffer.
// Parent owns the "both uploaded?" decision and the store wiring.
// ============================================================

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { AlertTriangle, FileText, Loader2, Upload, X } from "lucide-react";
import type { CompareDocumentMeta } from "@/lib/compare/types";
import {
  parseCompareDocument,
  type CompareSection,
} from "@/lib/compare/parse";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

type UploadStatus = "idle" | "parsing" | "ready" | "error";

/** What a successful upload yields — consumed by the store. */
export interface CompareUploadPayload {
  meta: CompareDocumentMeta;
  sections: CompareSection[];
  /** Non-null only for DOCX uploads; needed by the redline exporter. */
  originalBuffer: ArrayBuffer | null;
}

interface CompareUploadBoxProps {
  label: string;
  tone: "v1" | "v2";
  payload: CompareUploadPayload | null;
  onPick(payload: CompareUploadPayload): void;
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
  payload,
  onPick,
  onClear,
}: CompareUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>(
    payload ? "ready" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const t = TONE_CLASSES[tone];

  const accept = useCallback(
    async (file: File) => {
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setStatus("error");
        setErrorMsg(
          `Desteklenmeyen dosya türü. Kabul edilen: ${ACCEPTED_EXTENSIONS.join(", ")}`,
        );
        return;
      }

      setStatus("parsing");
      setErrorMsg(null);
      setPendingName(file.name);

      try {
        const result = await parseCompareDocument(file);
        const next: CompareUploadPayload = {
          meta: {
            fileName: result.fileName,
            sizeBytes: result.sizeBytes,
            parsedAt: result.parsedAt,
            sections: result.sections,
          },
          sections: result.sections,
          originalBuffer: result.originalBuffer,
        };
        setStatus("ready");
        setPendingName(null);
        onPick(next);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Belge işlenemedi.";
        setStatus("error");
        setErrorMsg(friendlyError(msg));
        setPendingName(null);
      }
    },
    [onPick],
  );

  const handleClear = useCallback(() => {
    setStatus("idle");
    setErrorMsg(null);
    setPendingName(null);
    onClear();
  }, [onClear]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (status === "parsing") return;
      const file = e.dataTransfer.files[0];
      if (file) void accept(file);
    },
    [accept, status],
  );

  const busy = status === "parsing";
  const errored = status === "error";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative rounded-2xl border-2 border-dashed p-8 min-h-[260px] flex flex-col items-center justify-center transition-all
        ${
          dragging
            ? `border-accent-primary bg-accent-primary/5 ring-2 ${t.ring}`
            : errored
              ? "border-accent-danger/40 bg-accent-danger/5"
              : payload
                ? "border-workspace-border bg-workspace-surface"
                : "border-workspace-border bg-workspace-elevated hover:border-accent-primary/40 hover:bg-workspace-surface"
        }`}
    >
      <div
        className={`absolute top-4 left-4 text-[11px] font-mono font-semibold tracking-widest uppercase ${t.label}`}
      >
        {label}
      </div>

      {busy ? (
        <div className="flex flex-col items-center text-center gap-3 w-full pt-4">
          <div
            className={`w-14 h-14 rounded-xl border ${t.chip} flex items-center justify-center`}
          >
            <Loader2 size={24} className="animate-spin" />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-text-primary break-all max-w-[280px]">
              {pendingName ?? "Belge ayrıştırılıyor…"}
            </p>
            <p className="text-sm text-text-tertiary mt-0.5">
              Metin çıkarılıyor, maddeler bölünüyor.
            </p>
          </div>
        </div>
      ) : payload ? (
        <div className="flex flex-col items-center text-center gap-3 w-full pt-4">
          <div
            className={`w-14 h-14 rounded-xl border ${t.chip} flex items-center justify-center`}
          >
            <FileText size={24} />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-text-primary break-all max-w-[280px]">
              {payload.meta.fileName}
            </p>
            <p className="text-sm text-text-tertiary mt-0.5">
              {formatSize(payload.meta.sizeBytes)} ·{" "}
              {payload.sections.length} madde
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
          >
            <X size={14} />
            Kaldır
          </button>
        </div>
      ) : errored ? (
        <div className="flex flex-col items-center text-center gap-3 w-full pt-4">
          <div className="w-14 h-14 rounded-xl border border-accent-danger/25 bg-accent-danger/10 text-accent-danger flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-text-primary">
              Ayrıştırma başarısız
            </p>
            <p className="text-sm text-text-tertiary mt-0.5 max-w-[320px]">
              {errorMsg ?? "Belge işlenirken beklenmeyen bir hata oluştu."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setErrorMsg(null);
              inputRef.current?.click();
            }}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-workspace-surface transition-colors"
          >
            Tekrar dene
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
          if (file) void accept(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function friendlyError(message: string): string {
  if (message.includes("DOCX_TOO_LARGE")) {
    return "DOCX dosyası 10 MB sınırını aşıyor. Daha küçük bir kopya deneyin.";
  }
  return message;
}
