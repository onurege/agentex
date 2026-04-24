// ============================================================
// Signatures — Compare (SSIM + dHash + aspect delta)
// ============================================================
//
// Preprocess'ten çıkmış iki 256×128 gri tonlamalı imzayı alır,
// üç bağımsız sinyali hesaplayıp tek bir güven yüzdesine
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
//
// Güven hesabı (ağırlıklı ortalama):
//   confidence = 0.55 · ssim  +  0.3 · (1 − hamming/64)  +  0.15 · (1 − min(1, aspectDelta))
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
}

export interface CompareManyInput {
  contractDataUrl: string;
  contractAspect: number;
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

  const ssimNorm = clamp01(ssim);
  const phashNorm = 1 - phashHamming / 64;
  const aspectNorm = 1 - Math.min(1, aspectRatioDelta);
  const confidence =
    0.55 * ssimNorm + 0.3 * phashNorm + 0.15 * aspectNorm;

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
    },
  };
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
