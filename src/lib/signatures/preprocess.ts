// ============================================================
// Signatures — Preprocess
// ============================================================
//
// Kırpılmış bölgeyi alıp SSIM / pHash için normalize edilmiş
// gri tonlamalı bir imza görüntüsü üretir. Hem iki imzanın aynı
// çözünürlükte karşılaştırılmasını sağlar hem de aspect ratio'yu
// bağımsız bir sinyal olarak yanlarında taşır.
//
// Pipeline:
//   1. Kaynak sayfayı yükle → kırpım dikdörtgenini canvas'a kopyala
//   2. Gri tonlama (NTSC luminance)
//   3. Otomatik tight bounding box — beyaz kenar padding'i at
//   4. Hedef boyuta (256×128) en-boy oranı koruyarak yerleştir,
//      geri kalanı beyazla doldur
//   5. Canvas → data URL
// ============================================================

import type { CropRegion } from "./types";

export const TARGET_WIDTH = 256;
export const TARGET_HEIGHT = 128;
/** Otsu benzeri sabit eşik — imza çizgileri için yeterince toleranslı. */
const DARK_THRESHOLD = 200;

export interface PreprocessResult {
  /** Normalize edilmiş 256×128 gri tonlamalı imza — data URL. */
  dataUrl: string;
  /** Ham kırpımın en-boy oranı (w / h), normalize öncesi. */
  aspectRatio: number;
  /** Normalize öncesi tight bbox içindeki koyu piksel yoğunluğu (0-1). */
  inkDensity: number;
}

export async function preprocessSignature(
  pageDataUrl: string,
  crop: CropRegion,
): Promise<PreprocessResult> {
  const img = await loadImage(pageDataUrl);

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.round(crop.width));
  cropCanvas.height = Math.max(1, Math.round(crop.height));
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) throw new Error("Canvas 2D context alınamadı.");
  cropCtx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );

  const imageData = cropCtx.getImageData(
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );
  const grey = toGrayscale(imageData);

  const bbox = tightBoundingBox(
    grey,
    cropCanvas.width,
    cropCanvas.height,
  );

  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const aspectRatio = bboxW / bboxH;

  const inkDensity = computeInkDensity(
    grey,
    cropCanvas.width,
    bbox,
  );

  // Hedef canvas'a aspect-preserving yerleştir.
  const out = document.createElement("canvas");
  out.width = TARGET_WIDTH;
  out.height = TARGET_HEIGHT;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D context alınamadı.");
  outCtx.fillStyle = "#ffffff";
  outCtx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  const scale = Math.min(
    TARGET_WIDTH / bboxW,
    TARGET_HEIGHT / bboxH,
  );
  const drawW = bboxW * scale;
  const drawH = bboxH * scale;
  const dx = (TARGET_WIDTH - drawW) / 2;
  const dy = (TARGET_HEIGHT - drawH) / 2;

  outCtx.drawImage(
    cropCanvas,
    bbox.minX,
    bbox.minY,
    bboxW,
    bboxH,
    dx,
    dy,
    drawW,
    drawH,
  );

  // Hedef canvas'ı gri tonlamaya çevir (bbox içeriği RGB olabilir).
  const outData = outCtx.getImageData(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  greyscaleInPlace(outData);
  outCtx.putImageData(outData, 0, 0);

  return {
    dataUrl: out.toDataURL("image/png"),
    aspectRatio,
    inkDensity,
  };
}

// --- Grayscale + helpers ----------------------------------------------------

function toGrayscale(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // NTSC luminance — hızlı ve imza için yeterince isabetli.
    out[j] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

function greyscaleInPlace(imageData: ImageData): void {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

function tightBoundingBox(
  grey: Uint8ClampedArray,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grey[y * width + x] < DARK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // Hiç koyu piksel yoksa tüm kırpımı döndür — bölme hatasını önlüyoruz.
  if (maxX < 0 || maxY < 0) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  }
  return { minX, minY, maxX, maxY };
}

function computeInkDensity(
  grey: Uint8ClampedArray,
  width: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const total = bboxW * bboxH;
  if (total === 0) return 0;
  let dark = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (grey[y * width + x] < DARK_THRESHOLD) dark++;
    }
  }
  return dark / total;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görüntü yüklenemedi."));
    img.src = src;
  });
}
