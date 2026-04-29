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
import { Check, Crop, Eraser, Loader2, RotateCcw, X } from "lucide-react";
import {
  analyzeSignatureMask,
  preprocessSignature,
  type SignatureMaskAnalysis,
  type PreprocessResult,
} from "@/lib/signatures/preprocess";
import type { CropRegion, SignatureSource } from "@/lib/signatures/types";

interface SignatureCropperProps {
  label: string;
  tone: "contract" | "reference";
  source: SignatureSource;
  onCropComplete(crop: CropRegion, result: PreprocessResult): void;
  onMaskUpdate?(dataUrl: string, analysis: SignatureMaskAnalysis): void;
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
  onMaskUpdate,
  onReset,
}: SignatureCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMask, setEditingMask] = useState(false);

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
        onCropComplete(box, result);
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
              İmzayı içeren dikdörtgeni fare ile sürükleyerek çizin. Sistem
              kaşe/yazı gürültüsünü ayıklayıp aşağıda imza maskesini gösterecek.
            </>
          )}
        </div>
      </footer>

      {source.signatureDataUrl && (
        <div className="px-4 py-3 border-t border-workspace-border bg-workspace-elevated">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PreviewImage
              label="Ham kırpım"
              src={source.rawCropDataUrl}
              alt="Kullanıcının seçtiği ham imza bölgesi"
            />
            <PreviewImage
              label="Karşılaştırılan imza maskesi"
              src={source.signatureDataUrl}
              alt="Kaşe ve yazı gürültüsü azaltılmış imza maskesi"
            />
          </div>
          {onMaskUpdate && source.signatureDataUrl && (
            <button
              type="button"
              onClick={() => setEditingMask((v) => !v)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-workspace-surface border border-workspace-border text-text-secondary hover:text-text-primary hover:border-accent-primary/30 transition-colors"
            >
              {editingMask ? <X size={12} /> : <Eraser size={12} />}
              {editingMask ? "Temizlemeyi kapat" : "Maskeyi temizle"}
            </button>
          )}
          {source.inkDensity !== null && (
            <p className="mt-2 text-[11px] text-text-tertiary leading-relaxed">
              Mürekkep yoğunluğu: %{Math.round(source.inkDensity * 100)}.
              Skor bu maskeye göre hesaplanır; ham kırpım sadece kontrol içindir.
            </p>
          )}
          {editingMask && source.signatureDataUrl && onMaskUpdate && (
            <MaskEditor
              maskDataUrl={source.signatureDataUrl}
              onCancel={() => setEditingMask(false)}
              onSave={(dataUrl, analysis) => {
                onMaskUpdate(dataUrl, analysis);
                setEditingMask(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MaskEditor({
  maskDataUrl,
  onCancel,
  onSave,
}: {
  maskDataUrl: string;
  onCancel(): void;
  onSave(dataUrl: string, analysis: SignatureMaskAnalysis): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const brushSize = 16;

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = maskDataUrl;
    return () => {
      cancelled = true;
    };
  }, [maskDataUrl]);

  const eraseAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrawing(true);
      eraseAt(event.clientX, event.clientY);
    },
    [eraseAt],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawing) return;
      eraseAt(event.clientX, event.clientY);
    },
    [drawing, eraseAt],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDrawing(false);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const analysis = await analyzeSignatureMask(dataUrl);
      onSave(dataUrl, analysis);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  return (
    <div className="mt-3 rounded-lg border border-accent-warning/30 bg-accent-warning/[0.05] p-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-semibold text-text-primary">
            Maskeyi elle temizle
          </p>
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            İmza olmayan siyah yazı/kaşe parçalarının üzerinden geçin.
            Beyaza sildiğiniz alanlar karşılaştırmaya dahil edilmez.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-primary hover:bg-workspace-surface transition-colors"
          >
            <X size={11} />
            Vazgeç
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary disabled:opacity-60 disabled:cursor-wait transition-colors"
          >
            <Check size={11} />
            Kaydet
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDrawing(false)}
        className="w-full max-w-[360px] rounded border border-workspace-border bg-white touch-none cursor-crosshair"
      />
    </div>
  );
}

function PreviewImage({
  label,
  src,
  alt,
}: {
  label: string;
  src: string | null;
  alt: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-text-tertiary mb-1">
        {label}
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-16 max-w-full rounded border border-workspace-border bg-white object-contain"
        />
      ) : (
        <div className="h-16 rounded border border-dashed border-workspace-border bg-workspace-surface" />
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
