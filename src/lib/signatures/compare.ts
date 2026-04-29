// ============================================================
// Signatures — Compare (SSIM + dHash + aspect delta + mask quality)
// ============================================================
//
// Preprocess'ten çıkmış iki 256×128 gri tonlamalı imzayı alır,
// bağımsız sinyalleri hesaplayıp tek bir güven yüzdesine
// ağırlıklı olarak çevirir. Bütünüyle tarayıcıda çalışır; pure
// JS, extra bağımlılık yok.
//
// Sinyaller:
//   1. SSIM  — 8×8 non-overlap tile ortalaması (struktürel benzerlik)
//   2. dHash — 9×8 resize sonrası yatay gradyan yönü farkı,
//             Hamming mesafesi (0 ideal, 64 tamamen farklı)
//   3. aspectRatioDelta — orijinal kırpımdaki en-boy oranı farkı
//      (normalize sonrası "bu iki imzanın şekli aslında ne kadar
//      farklıydı" bilgisini saklar)
//   4. mask quality — kaşe/yazı kirliliği ve aşırı yoğun maskeyi
//      SSIM / dHash'ın skoru yapay yükseltmesine karşı frenler
//
// Band:
//   >= 0.75 → match
//   >= 0.50 → borderline
//   <  0.50 → no_match
// ============================================================

import type {
  ComparisonResult,
  ComparisonSignals,
  ComparisonVerdict,
  SpecimenMatch,
} from "./types";
import { TARGET_HEIGHT, TARGET_WIDTH } from "./preprocess";

export interface SpecimenInput {
  id: string;
  label: string;
  dataUrl: string;
  aspect: number;
  inkDensity: number;
}

export interface CompareManyInput {
  contractDataUrl: string;
  contractAspect: number;
  contractInkDensity: number;
  specimens: SpecimenInput[];
}

/**
 * Sözleşme imzasını N referans örneğine karşı sırayla karşılaştırır.
 * En yüksek güven veren örnek top-line verdict olarak döner; tümü
 * specimenMatches[] altında gösterilir.
 */
export async function compareAgainstSpecimens(
  input: CompareManyInput,
): Promise<ComparisonResult> {
  if (input.specimens.length === 0) {
    throw new Error("Karşılaştırılacak referans örneği yok.");
  }

  const contractGrey = await greyBytesFromDataUrl(input.contractDataUrl);

  const matches: SpecimenMatch[] = [];
  for (const specimen of input.specimens) {
    const referenceGrey = await greyBytesFromDataUrl(specimen.dataUrl);
    const pair = scorePair(
      contractGrey,
      referenceGrey,
      input.contractAspect,
      specimen.aspect,
      input.contractInkDensity,
      specimen.inkDensity,
    );
    matches.push({
      specimenId: specimen.id,
      label: specimen.label,
      confidence: pair.confidence,
      verdict: pair.verdict,
      signals: pair.signals,
    });
  }

  // En yüksek güveni seç
  let best = matches[0];
  for (const m of matches) {
    if (m.confidence > best.confidence) best = m;
  }

  return {
    confidence: best.confidence,
    verdict: best.verdict,
    bestMatchSpecimenId: best.specimenId,
    specimenMatches: matches,
    signals: best.signals,
    computedAt: new Date().toISOString(),
  };
}

// --- Pairwise scoring (contractGrey × referenceGrey) ------------------------

interface PairScore {
  confidence: number;
  verdict: ComparisonVerdict;
  signals: ComparisonSignals;
}

function scorePair(
  contractGrey: Uint8Array,
  referenceGrey: Uint8Array,
  contractAspect: number,
  referenceAspect: number,
  contractInkDensity: number,
  referenceInkDensity: number,
): PairScore {
  const ssim = ssimScore(
    contractGrey,
    referenceGrey,
    TARGET_WIDTH,
    TARGET_HEIGHT,
  );
  const hashA = dhash(contractGrey, TARGET_WIDTH, TARGET_HEIGHT);
  const hashB = dhash(referenceGrey, TARGET_WIDTH, TARGET_HEIGHT);
  const phashHamming = hamming(hashA, hashB);
  const aspectRatioDelta =
    Math.abs(contractAspect - referenceAspect) /
    Math.max(contractAspect, referenceAspect, 0.001);
  const inkDensityDelta =
    Math.abs(contractInkDensity - referenceInkDensity) /
    Math.max(contractInkDensity, referenceInkDensity, 0.001);
  const contractQuality = analyzeMaskQuality(contractGrey);
  const referenceQuality = analyzeMaskQuality(referenceGrey);
  const pairQuality = combineMaskQuality(
    contractQuality,
    referenceQuality,
    inkDensityDelta,
  );

  const ssimNorm = clamp01(ssim);
  const phashNorm = 1 - phashHamming / 64;
  const aspectNorm = 1 - Math.min(1, aspectRatioDelta);
  const inkDensityNorm = 1 - Math.min(1, inkDensityDelta);
  const minInkDensity = Math.min(contractInkDensity, referenceInkDensity);
  const inkPresenceNorm = clamp01(minInkDensity / 0.01);
  const visualConfidence =
    0.45 * ssimNorm +
    0.25 * phashNorm +
    0.15 * aspectNorm +
    0.15 * inkDensityNorm;
  const rawConfidence = visualConfidence * (0.35 + 0.65 * inkPresenceNorm);
  const cappedConfidence = Math.min(rawConfidence, pairQuality.maxConfidence);
  const confidence = cappedConfidence * pairQuality.multiplier;

  const verdict: ComparisonVerdict =
    confidence >= 0.75
      ? "match"
      : confidence >= 0.5
        ? "borderline"
        : "no_match";

  return {
    confidence: clamp01(confidence),
    verdict,
    signals: {
      ssim: clamp01(ssim),
      phashHamming,
      aspectRatioDelta,
      inkDensityDelta,
    },
  };
}

interface MaskQuality {
  inkRatio: number;
  rowContamination: number;
  continuity: number;
  quality: number;
}

interface PairMaskQuality {
  multiplier: number;
  maxConfidence: number;
}

function analyzeMaskQuality(grey: Uint8Array): MaskQuality {
  const bbox = tightBoundingBox(grey, TARGET_WIDTH, TARGET_HEIGHT);
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const darkPixels = countDarkPixels(grey, bbox);
  const inkRatio = darkPixels / Math.max(bboxW * bboxH, 1);
  const rowContamination = measureRowContamination(grey, bbox);
  const continuity = measureContinuity(grey, bbox);

  let quality = 1;
  if (inkRatio > 0.34) quality -= Math.min(0.45, (inkRatio - 0.34) * 1.6);
  if (inkRatio < 0.01) quality -= 0.45;
  if (rowContamination > 0.14) {
    quality -= Math.min(0.5, (rowContamination - 0.14) * 2.2);
  }
  if (continuity < 0.32) quality -= 0.22;

  return {
    inkRatio,
    rowContamination,
    continuity,
    quality: clamp01(quality),
  };
}

function combineMaskQuality(
  contract: MaskQuality,
  reference: MaskQuality,
  inkDensityDelta: number,
): PairMaskQuality {
  const worstQuality = Math.min(contract.quality, reference.quality);
  const worstContamination = Math.max(
    contract.rowContamination,
    reference.rowContamination,
  );
  const worstInkRatio = Math.max(contract.inkRatio, reference.inkRatio);

  let maxConfidence = 1;
  let multiplier = 0.75 + 0.25 * worstQuality;

  if (inkDensityDelta >= 0.55) {
    maxConfidence = Math.min(maxConfidence, 0.49);
    multiplier *= 0.88;
  } else if (inkDensityDelta >= 0.38) {
    maxConfidence = Math.min(maxConfidence, 0.58);
    multiplier *= 0.94;
  }

  if (worstContamination >= 0.2 || worstInkRatio >= 0.42) {
    maxConfidence = Math.min(maxConfidence, 0.48);
    multiplier *= 0.82;
  } else if (worstContamination >= 0.14 || worstInkRatio >= 0.34) {
    maxConfidence = Math.min(maxConfidence, 0.58);
    multiplier *= 0.9;
  }

  if (worstQuality < 0.55) {
    maxConfidence = Math.min(maxConfidence, 0.52);
  }

  return { multiplier: clamp01(multiplier), maxConfidence };
}

function tightBoundingBox(
  grey: Uint8Array,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grey[y * width + x] >= 220) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  }

  return { minX, minY, maxX, maxY };
}

function countDarkPixels(
  grey: Uint8Array,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  let count = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (grey[y * TARGET_WIDTH + x] < 220) count++;
    }
  }
  return count;
}

function measureRowContamination(
  grey: Uint8Array,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  let contaminatedRows = 0;
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;

  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    let count = 0;
    let runs = 0;
    let inRun = false;

    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (grey[y * TARGET_WIDTH + x] >= 220) {
        inRun = false;
        continue;
      }
      count++;
      if (!inRun) {
        runs++;
        inRun = true;
      }
    }

    const fill = count / Math.max(bboxW, 1);
    if (runs >= 4 && fill >= 0.16) contaminatedRows++;
  }

  return contaminatedRows / Math.max(bboxH, 1);
}

function measureContinuity(
  grey: Uint8Array,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const bboxH = bbox.maxY - bbox.minY + 1;
  let best = 0;

  for (let x = bbox.minX; x <= bbox.maxX; x++) {
    let support = 0;
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
      let hasInk = false;
      for (let xx = Math.max(bbox.minX, x - 2); xx <= Math.min(bbox.maxX, x + 2); xx++) {
        if (grey[y * TARGET_WIDTH + xx] < 220) {
          hasInk = true;
          break;
        }
      }
      if (hasInk) support++;
    }
    if (support > best) best = support;
  }

  return best / Math.max(bboxH, 1);
}

// --- Grayscale loader -------------------------------------------------------

async function greyBytesFromDataUrl(dataUrl: string): Promise<Uint8Array> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context alınamadı.");
  ctx.drawImage(img, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  const { data } = ctx.getImageData(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  const grey = new Uint8Array(TARGET_WIDTH * TARGET_HEIGHT);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    grey[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
  }
  return grey;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görüntü yüklenemedi."));
    img.src = src;
  });
}

// --- SSIM -------------------------------------------------------------------

function ssimScore(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
): number {
  const L = 255;
  const K1 = 0.01;
  const K2 = 0.03;
  const c1 = (K1 * L) ** 2;
  const c2 = (K2 * L) ** 2;
  const win = 8;

  let total = 0;
  let tiles = 0;

  for (let y = 0; y + win <= height; y += win) {
    for (let x = 0; x + win <= width; x += win) {
      let sumA = 0;
      let sumB = 0;
      for (let j = 0; j < win; j++) {
        const row = (y + j) * width + x;
        for (let i = 0; i < win; i++) {
          sumA += a[row + i];
          sumB += b[row + i];
        }
      }
      const n = win * win;
      const muA = sumA / n;
      const muB = sumB / n;

      let varA = 0;
      let varB = 0;
      let cov = 0;
      for (let j = 0; j < win; j++) {
        const row = (y + j) * width + x;
        for (let i = 0; i < win; i++) {
          const da = a[row + i] - muA;
          const db = b[row + i] - muB;
          varA += da * da;
          varB += db * db;
          cov += da * db;
        }
      }
      varA /= n - 1;
      varB /= n - 1;
      cov /= n - 1;

      const num = (2 * muA * muB + c1) * (2 * cov + c2);
      const den = (muA * muA + muB * muB + c1) * (varA + varB + c2);
      total += num / den;
      tiles++;
    }
  }
  return tiles > 0 ? total / tiles : 0;
}

// --- dHash (64-bit) ---------------------------------------------------------

/**
 * 64-bit dHash. Bigint literal kullanmamak için iki 32-bit yarıya
 * bölünmüş düz uint olarak saklanır; hamming bunların üzerinde
 * XOR + popcount çalıştırır.
 */
interface DHash64 {
  lo: number; // alt 32 bit
  hi: number; // üst 32 bit
}

function dhash(
  grey: Uint8Array,
  width: number,
  height: number,
): DHash64 {
  // 9 × 8 örnek al (nearest-neighbor resize)
  const sampled = new Uint8Array(9 * 8);
  for (let y = 0; y < 8; y++) {
    const sy = Math.floor(((y + 0.5) / 8) * height);
    for (let x = 0; x < 9; x++) {
      const sx = Math.floor(((x + 0.5) / 9) * width);
      sampled[y * 9 + x] = grey[sy * width + sx];
    }
  }

  // Yatay komşu piksel farkı → 64 bit
  let lo = 0;
  let hi = 0;
  let bit = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (sampled[y * 9 + x] > sampled[y * 9 + x + 1]) {
        if (bit < 32) {
          lo = (lo | (1 << bit)) >>> 0;
        } else {
          hi = (hi | (1 << (bit - 32))) >>> 0;
        }
      }
      bit++;
    }
  }
  return { lo, hi };
}

function hamming(a: DHash64, b: DHash64): number {
  return popcount32(a.lo ^ b.lo) + popcount32(a.hi ^ b.hi);
}

function popcount32(n: number): number {
  // Hacker's Delight klasik popcount
  let x = n >>> 0;
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
