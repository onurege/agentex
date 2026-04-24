"use client";

// ============================================================
// SignatureSourceCard — Tek taraf için yükleme + önizleme
// ============================================================
//
// Sözleşme ve sirküsü için aynı bileşen iki kere kullanılır.
// Boş halde drag-drop zone; yüklü halde sayfa küçük resmi +
// dosya bilgisi + "kaldır" aksiyonu. Kırpma arayüzü commit 3'te
// bu kart üstüne bağlanacak.
// ============================================================

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { AlertTriangle, FileText, Loader2, Upload, X } from "lucide-react";
import {
  SignatureLoadError,
  loadFileToSource,
} from "@/lib/signatures/loader";
import type { SignatureSource } from "@/lib/signatures/types";

const ACCEPTED = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

type Status = "idle" | "loading" | "ready" | "error";

interface SignatureSourceCardProps {
  label: string;
  description: string;
  tone: "contract" | "reference";
  source: SignatureSource;
  onLoad(source: SignatureSource): void;
  onClear(): void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TONE_CLASSES = {
  contract: {
    label: "text-accent-info",
    chip: "bg-accent-info/10 text-accent-info border-accent-info/25",
    ring: "ring-accent-info/20",
  },
  reference: {
    label: "text-accent-primary",
    chip: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
    ring: "ring-accent-primary/20",
  },
} as const;

export function SignatureSourceCard({
  label,
  description,
  tone,
  source,
  onLoad,
  onClear,
}: SignatureSourceCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>(
    source.pageDataUrl ? "ready" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const t = TONE_CLASSES[tone];

  const accept = useCallback(
    async (file: File) => {
      setStatus("loading");
      setError(null);
      try {
        const result = await loadFileToSource(file);
        setStatus("ready");
        onLoad(result);
      } catch (err) {
        const msg =
          err instanceof SignatureLoadError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Dosya yüklenemedi.";
        setStatus("error");
        setError(msg);
      }
    },
    [onLoad],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (status === "loading") return;
      const file = e.dataTransfer.files[0];
      if (file) void accept(file);
    },
    [accept, status],
  );

  const handleClear = useCallback(() => {
    setStatus("idle");
    setError(null);
    onClear();
  }, [onClear]);

  const hasSource = Boolean(source.pageDataUrl);
  const busy = status === "loading";
  const errored = status === "error";

  return (
    <div className="rounded-xl border border-workspace-border bg-workspace-surface p-5">
      <header className="mb-3">
        <div className={`text-[11px] font-mono font-semibold tracking-widest uppercase ${t.label}`}>
          {label}
        </div>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
          {description}
        </p>
      </header>

      {hasSource && !errored ? (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-workspace-border bg-workspace-elevated">
            <img
              src={source.pageDataUrl ?? ""}
              alt={`${label} sayfası`}
              className="w-full h-auto max-h-[360px] object-contain"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">
                {source.fileName}
              </p>
              <p className="text-xs text-text-tertiary font-mono mt-0.5">
                {source.fileType.toUpperCase()} · {formatSize(source.fileSize)}{" "}
                · {source.pageWidth}×{source.pageHeight}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-accent-danger hover:bg-accent-danger/10 transition-colors shrink-0"
            >
              <X size={13} />
              Kaldır
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative rounded-lg border-2 border-dashed min-h-[220px] flex flex-col items-center justify-center p-6 text-center transition-all
            ${
              dragging
                ? `border-accent-primary bg-accent-primary/5 ring-2 ${t.ring}`
                : errored
                  ? "border-accent-danger/40 bg-accent-danger/5"
                  : "border-workspace-border bg-workspace-elevated hover:border-accent-primary/40"
            }`}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-2 text-text-secondary">
              <Loader2 size={22} className="animate-spin text-accent-primary" />
              <span className="text-sm">Dosya işleniyor…</span>
            </div>
          ) : errored ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl border border-accent-danger/25 bg-accent-danger/10 text-accent-danger flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <p className="text-sm text-text-primary font-semibold">
                Yükleme başarısız
              </p>
              <p className="text-xs text-text-tertiary max-w-[260px]">
                {error ?? "Bilinmeyen hata."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setError(null);
                  inputRef.current?.click();
                }}
                className="mt-1 text-xs font-medium text-text-secondary hover:text-text-primary underline"
              >
                Tekrar dene
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-3 w-full"
            >
              <div className={`w-12 h-12 rounded-xl border ${t.chip} flex items-center justify-center`}>
                {tone === "contract" ? (
                  <FileText size={20} />
                ) : (
                  <Upload size={20} />
                )}
              </div>
              <div>
                <p className="font-display text-base font-semibold text-text-primary">
                  Dosya yükle
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Sürükleyip bırakın veya tıklayın
                </p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">
                  {ACCEPTED.join(" · ")} · max 10 MB
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPTED.join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void accept(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
