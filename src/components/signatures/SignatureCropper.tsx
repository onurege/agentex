"use client";

// ============================================================
// SignatureCropper — Sayfa üstünde bölge kırpma
// ============================================================
//
// Yüklenmiş sayfa görüntüsünü gösterir, üstüne mouse/touch ile
// dikdörtgen çizdirir. Mouseup anında kırpım preprocess'ten
// geçirilir ve data URL olarak store'a yazılır. Kullanıcı istediği
// kadar yeniden çizebilir; her yeni çizim önceki result'ı geçersiz
// kılar.
// ============================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Crop, Loader2, RotateCcw } from "lucide-react";
import { preprocessSignature } from "@/lib/signatures/preprocess";
import type { CropRegion, SignatureSource } from "@/lib/signatures/types";

interface SignatureCropperProps {
  label: string;
  tone: "contract" | "reference";
  source: SignatureSource;
  onCropComplete(crop: CropRegion, signatureDataUrl: string): void;
  onReset(): void;
}

interface DragState {
  /** Başlangıç noktası — source-piksel koordinatı. */
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const TONE_CLASSES = {
  contract: "border-accent-info/30",
  reference: "border-accent-primary/30",
} as const;

export function SignatureCropper({
  label,
  tone,
  source,
  onCropComplete,
  onReset,
}: SignatureCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toneClass = TONE_CLASSES[tone];

  // Kırpım halini görsel olarak hangisinden çizeceğimizi karar ver:
  // aktif drag varsa onu, yoksa store'daki crop'u, o da yoksa hiç.
  const visibleBox = useMemo(() => {
    if (drag) {
      return normalizeBox(
        drag.startX,
        drag.startY,
        drag.currentX,
        drag.currentY,
      );
    }
    if (source.crop) return source.crop;
    return null;
  }, [drag, source.crop]);

  const toSourceCoords = useCallback(
    (clientX: number, clientY: number) => {
      const el = overlayRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const scaleX = source.pageWidth / rect.width;
      const scaleY = source.pageHeight / rect.height;
      const x = clamp(
        (clientX - rect.left) * scaleX,
        0,
        source.pageWidth - 1,
      );
      const y = clamp(
        (clientY - rect.top) * scaleY,
        0,
        source.pageHeight - 1,
      );
      return { x, y };
    },
    [source.pageWidth, source.pageHeight],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!source.pageDataUrl || busy) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = toSourceCoords(e.clientX, e.clientY);
      setDrag({ startX: x, startY: y, currentX: x, currentY: y });
      setError(null);
    },
    [source.pageDataUrl, busy, toSourceCoords],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      const { x, y } = toSourceCoords(e.clientX, e.clientY);
      setDrag({ ...drag, currentX: x, currentY: y });
    },
    [drag, toSourceCoords],
  );

  const handlePointerUp = useCallback(
    async (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const box = normalizeBox(
        drag.startX,
        drag.startY,
        drag.currentX,
        drag.currentY,
      );
      setDrag(null);

      // Küçük kırpımları yok say — yanlışlık kaydırma kaçaklarına karşı.
      if (box.width < 12 || box.height < 8) {
        return;
      }

      if (!source.pageDataUrl) return;

      setBusy(true);
      setError(null);
      try {
        const result = await preprocessSignature(source.pageDataUrl, box);
        onCropComplete(box, result.dataUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kırpma başarısız.",
        );
      } finally {
        setBusy(false);
      }
    },
    [drag, source.pageDataUrl, onCropComplete],
  );

  const handleReset = useCallback(() => {
    onReset();
    setDrag(null);
    setError(null);
  }, [onReset]);

  // Kaynak değişirse state'i temizle.
  useEffect(() => {
    setDrag(null);
    setError(null);
  }, [source.pageDataUrl]);

  if (!source.pageDataUrl) return null;

  return (
    <div className={`rounded-xl border ${toneClass} bg-workspace-surface overflow-hidden`}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-workspace-border">
        <div className="text-sm font-semibold text-text-primary">
          {label} · imza bölgesini seç
        </div>
        {source.crop && !busy && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-workspace-elevated transition-colors"
          >
            <RotateCcw size={12} />
            Sıfırla
          </button>
        )}
      </header>

      <div
        ref={overlayRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative select-none touch-none cursor-crosshair bg-workspace-elevated"
        style={{ aspectRatio: `${source.pageWidth} / ${source.pageHeight}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={source.pageDataUrl}
          alt={`${label} sayfası`}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />

        {visibleBox && (
          <div
            className="absolute border-2 border-accent-primary bg-accent-primary/10 pointer-events-none"
            style={{
              left: `${(visibleBox.x / source.pageWidth) * 100}%`,
              top: `${(visibleBox.y / source.pageHeight) * 100}%`,
              width: `${(visibleBox.width / source.pageWidth) * 100}%`,
              height: `${(visibleBox.height / source.pageHeight) * 100}%`,
            }}
          />
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] text-workspace-surface">
            <span className="inline-flex items-center gap-2 rounded-lg bg-workspace-surface text-text-primary px-3 py-2 text-sm shadow-medium">
              <Loader2 size={14} className="animate-spin text-accent-primary" />
              İmza işleniyor…
            </span>
          </div>
        )}
      </div>

      <footer className="px-4 py-3 border-t border-workspace-border flex items-start gap-3">
        <Crop size={14} className="mt-0.5 text-text-tertiary shrink-0" />
        <div className="text-xs text-text-tertiary leading-relaxed">
          {error ? (
            <span className="text-accent-danger">{error}</span>
          ) : source.crop ? (
            <>
              Seçim kaydedildi. Farklı bir bölge için yeniden sürükleyin,
              sıfırlamak için sağ-üstteki butonu kullanın.
            </>
          ) : (
            <>
              İmzayı içeren dikdörtgeni fare ile sürükleyerek çizin. Çok
              geniş tutmayın — sadece imza bölgesi seçilmeli.
            </>
          )}
        </div>
      </footer>

      {source.signatureDataUrl && (
        <div className="px-4 py-3 border-t border-workspace-border bg-workspace-elevated flex items-center gap-3">
          <div className="text-[11px] font-mono font-semibold tracking-widest uppercase text-text-tertiary">
            Önizleme
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source.signatureDataUrl}
            alt="İşlenmiş imza"
            className="h-12 rounded border border-workspace-border bg-white"
          />
        </div>
      )}
    </div>
  );
}

function normalizeBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CropRegion {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
