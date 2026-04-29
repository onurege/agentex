// ============================================================
// Signatures — Preprocess
// ============================================================
//
// Kırpılmış bölgeyi alıp SSIM / pHash için normalize edilmiş
// siyah-beyaz bir imza stroke maskesi üretir. Hem iki imzanın aynı
// çözünürlükte karşılaştırılmasını sağlar hem de aspect ratio'yu
// bağımsız bir sinyal olarak yanlarında taşır.
//
// Pipeline:
//   1. Kaynak sayfayı yükle → kırpım dikdörtgenini canvas'a kopyala
//   2. Kaşe/yazı/zemin gürültüsünü azaltan ink maskesi çıkar
//   3. Otomatik tight bounding box — maske dışındaki padding'i at
//   4. Hedef boyuta (256×128) en-boy oranı koruyarak yerleştir,
//      geri kalanı beyazla doldur
//   5. Canvas → data URL
// ============================================================

import type { CropRegion } from "./types";

export const TARGET_WIDTH = 256;
export const TARGET_HEIGHT = 128;
/** Otsu benzeri sabit eşik — imza çizgileri için yeterince toleranslı. */
const DARK_THRESHOLD = 200;
const MIN_COMPONENT_AREA = 10;
const MIN_SIGNATURE_COMPONENT_WIDTH = 14;
const MIN_SIGNATURE_COMPONENT_HEIGHT = 7;

export interface PreprocessResult {
  /** Normalize edilmiş 256×128 imza stroke maskesi — data URL. */
  dataUrl: string;
  /** Kullanıcının seçtiği ham kırpım — data URL. */
  rawDataUrl: string;
  /** Ham kırpımın en-boy oranı (w / h), normalize öncesi. */
  aspectRatio: number;
  /** Normalize öncesi tight bbox içindeki koyu piksel yoğunluğu (0-1). */
  inkDensity: number;
}

export interface SignatureMaskAnalysis {
  aspectRatio: number;
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
  const inkMask = extractSignatureInkMask(imageData);

  const bbox = tightBoundingBox(
    inkMask,
    cropCanvas.width,
    cropCanvas.height,
  );

  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const aspectRatio = bboxW / bboxH;

  const inkDensity = computeInkDensity(
    inkMask,
    cropCanvas.width,
    bbox,
  );

  const maskCanvas = maskToCanvas(inkMask, cropCanvas.width, cropCanvas.height);

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
    maskCanvas,
    bbox.minX,
    bbox.minY,
    bboxW,
    bboxH,
    dx,
    dy,
    drawW,
    drawH,
  );

  return {
    dataUrl: out.toDataURL("image/png"),
    rawDataUrl: cropCanvas.toDataURL("image/png"),
    aspectRatio,
    inkDensity,
  };
}

export async function analyzeSignatureMask(
  maskDataUrl: string,
): Promise<SignatureMaskAnalysis> {
  const img = await loadImage(maskDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || TARGET_WIDTH;
  canvas.height = img.naturalHeight || TARGET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context alınamadı.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grey = toGrayscale(imageData);
  const bbox = tightBoundingBox(grey, canvas.width, canvas.height);
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;

  return {
    aspectRatio: bboxW / Math.max(bboxH, 1),
    inkDensity: computeInkDensity(grey, canvas.width, bbox),
  };
}

// --- Ink mask + helpers -----------------------------------------------------

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

interface InkComponent {
  pixels: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  boxW: number;
  boxH: number;
  density: number;
  centerX: number;
  centerY: number;
  meanR: number;
  meanG: number;
  meanB: number;
  saturation: number;
  textLineLike: boolean;
  stampClusterLike: boolean;
  score: number;
}

function extractSignatureInkMask(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const grey = toGrayscale(imageData);
  const rawCandidates = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (isInkCandidate(data[i], data[i + 1], data[i + 2], grey[p])) {
      rawCandidates[p] = 1;
    }
  }

  const componentCleaned = cloneMask(rawCandidates);
  const firstPassComponents = collectInkComponents(componentCleaned, imageData);
  markTextLineComponents(firstPassComponents, width);
  markStampClusterComponents(firstPassComponents, width, height);
  suppressTextLikeRows(componentCleaned, firstPassComponents, width, height);

  const strokeCleaned = extractLongStrokeCandidateMask(
    componentCleaned,
    width,
    height,
  );

  const candidates = chooseBestCandidateMask(
    [componentCleaned, strokeCleaned],
    imageData,
  );

  const components = collectInkComponents(candidates, imageData);
  markTextLineComponents(components, width);
  markStampClusterComponents(components, width, height);
  for (const component of components) {
    component.score = scoreSignatureComponent(component, width, height);
  }

  return renderScoredComponentsToMask(candidates, components, width, height);
}

function cloneMask(mask: Uint8Array): Uint8Array {
  const next = new Uint8Array(mask.length);
  next.set(mask);
  return next;
}

function chooseBestCandidateMask(
  candidates: Uint8Array[],
  imageData: ImageData,
): Uint8Array {
  const { width, height } = imageData;
  const scored = candidates.map((candidate) => {
    const components = collectInkComponents(candidate, imageData);
    markTextLineComponents(components, width);
    markStampClusterComponents(components, width, height);
    for (const component of components) {
      component.score = scoreSignatureComponent(component, width, height);
    }

    const rendered = renderScoredComponentsToMask(
      candidate,
      components,
      width,
      height,
    );

    return {
      candidate,
      rendered,
      quality: measureRenderedSignatureMask(rendered, width, height),
    };
  });

  const primary = scored[0];
  const strokeOnly = scored[1];
  if (!primary || !strokeOnly) return primary?.candidate ?? candidates[0];

  const strokeLosesMostInk =
    strokeOnly.quality.darkPixels < primary.quality.darkPixels * 0.58;
  const primaryLooksClean =
    primary.quality.textContamination <= 0.12 &&
    primary.quality.inkDensity <= 0.38;

  if (primaryLooksClean && strokeLosesMostInk) {
    return primary.candidate;
  }

  const primaryLooksContaminated =
    primary.quality.textContamination >= 0.16 ||
    primary.quality.inkDensity > 0.42;
  const strokeMeaningfullyCleaner =
    strokeOnly.quality.textContamination <= primary.quality.textContamination * 0.62 &&
    strokeOnly.quality.continuity >= primary.quality.continuity * 0.72;

  if (primaryLooksContaminated && strokeMeaningfullyCleaner) {
    return strokeOnly.candidate;
  }

  const strokeClearlyBetter =
    !strokeLosesMostInk &&
    strokeOnly.quality.score >= primary.quality.score + 1.2;

  return strokeClearlyBetter ? strokeOnly.candidate : primary.candidate;
}

function isInkCandidate(
  r: number,
  g: number,
  b: number,
  grey: number,
): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;

  // Keep color information alive: blue/red/black marks can all be
  // candidates, but pure light background should not enter component
  // analysis. Colored stamps are suppressed later at component level.
  const darkNeutral = grey < DARK_THRESHOLD;
  const coloredInk = saturation > 35 && grey < 235 && max < 250;
  return darkNeutral || coloredInk;
}

function collectInkComponents(
  candidates: Uint8Array,
  imageData: ImageData,
): InkComponent[] {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const pixels: number[] = [];
  const components: InkComponent[] = [];

  for (let start = 0; start < candidates.length; start++) {
    if (!candidates[start] || visited[start]) continue;

    queue.length = 0;
    pixels.length = 0;
    queue.push(start);
    visited[start] = 1;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (let q = 0; q < queue.length; q++) {
      const idx = queue[q];
      pixels.push(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);
      const di = idx * 4;
      sumR += data[di];
      sumG += data[di + 1];
      sumB += data[di + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const next = ny * width + nx;
          if (!candidates[next] || visited[next]) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
    }

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const area = pixels.length;
    const meanR = sumR / Math.max(area, 1);
    const meanG = sumG / Math.max(area, 1);
    const meanB = sumB / Math.max(area, 1);
    components.push({
      pixels: [...pixels],
      minX,
      minY,
      maxX,
      maxY,
      area,
      boxW,
      boxH,
      density: area / Math.max(boxW * boxH, 1),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      meanR,
      meanG,
      meanB,
      saturation: Math.max(meanR, meanG, meanB) - Math.min(meanR, meanG, meanB),
      textLineLike: false,
      stampClusterLike: false,
      score: 0,
    });
  }

  return components;
}

function markTextLineComponents(
  components: InkComponent[],
  width: number,
): void {
  const compact = components.filter((c) =>
    c.area >= 4 &&
    c.area <= 420 &&
    c.boxH >= 4 &&
    c.boxH <= 38 &&
    c.boxW <= Math.max(90, width * 0.28) &&
    c.density >= 0.12,
  );

  for (const component of compact) {
    const row = compact.filter(
      (other) => Math.abs(other.centerY - component.centerY) <= Math.max(6, component.boxH * 0.5),
    );
    if (row.length < 3) continue;

    const minX = Math.min(...row.map((c) => c.minX));
    const maxX = Math.max(...row.map((c) => c.maxX));
    const span = maxX - minX + 1;
    const avgH = row.reduce((sum, c) => sum + c.boxH, 0) / row.length;
    const heightVariance =
      row.reduce((sum, c) => sum + Math.abs(c.boxH - avgH), 0) / row.length;
    const similarHeights = heightVariance <= Math.max(5, avgH * 0.45);

    if (span > width * 0.18 && similarHeights) {
      for (const item of row) item.textLineLike = true;
    }
  }
}

function markStampClusterComponents(
  components: InkComponent[],
  width: number,
  height: number,
): void {
  const colorful = components.filter((c) => {
    const relW = c.boxW / width;
    const relH = c.boxH / height;
    const blueOrPurple =
      c.meanB > c.meanR + 12 &&
      c.meanB > c.meanG - 18 &&
      c.saturation > 28;

    return (
      blueOrPurple &&
      c.area >= 8 &&
      c.boxH <= Math.max(48, height * 0.32) &&
      relW <= 0.45 &&
      relH <= 0.45
    );
  });

  for (const component of colorful) {
    const nearby = colorful.filter((other) => {
      const verticalGap =
        other.minY > component.maxY
          ? other.minY - component.maxY
          : component.minY > other.maxY
            ? component.minY - other.maxY
            : 0;
      const horizontalOverlap =
        Math.min(component.maxX, other.maxX) - Math.max(component.minX, other.minX);
      const sameBlock =
        verticalGap <= Math.max(14, height * 0.04) &&
        horizontalOverlap > -Math.max(42, width * 0.08);
      return sameBlock;
    });

    if (nearby.length < 4) continue;

    const minX = Math.min(...nearby.map((c) => c.minX));
    const maxX = Math.max(...nearby.map((c) => c.maxX));
    const minY = Math.min(...nearby.map((c) => c.minY));
    const maxY = Math.max(...nearby.map((c) => c.maxY));
    const spanW = maxX - minX + 1;
    const spanH = maxY - minY + 1;
    const textLikeCount = nearby.filter((c) => c.textLineLike || c.boxH <= 34).length;

    if (
      spanW >= width * 0.24 &&
      spanH >= height * 0.12 &&
      textLikeCount >= Math.max(3, nearby.length * 0.55)
    ) {
      for (const item of nearby) item.stampClusterLike = true;
    }
  }
}

function suppressTextLikeRows(
  candidates: Uint8Array,
  components: InkComponent[],
  width: number,
  height: number,
): void {
  const rowCounts = new Uint16Array(height);
  const rowMinX = new Int32Array(height);
  const rowMaxX = new Int32Array(height);
  rowMinX.fill(width);
  rowMaxX.fill(-1);

  const textPixels = new Uint8Array(width * height);
  for (const component of components) {
    if (!component.textLineLike && !component.stampClusterLike) continue;
    for (const idx of component.pixels) {
      textPixels[idx] = 1;
      const x = idx % width;
      const y = Math.floor(idx / width);
      rowCounts[y]++;
      if (x < rowMinX[y]) rowMinX[y] = x;
      if (x > rowMaxX[y]) rowMaxX[y] = x;
    }
  }

  for (let y = 0; y < height; y++) {
    const span = rowMaxX[y] - rowMinX[y] + 1;
    const denseTextRow =
      rowCounts[y] >= Math.max(10, width * 0.035) &&
      span >= width * 0.16;
    if (!denseTextRow) continue;

    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);
    for (let yy = y0; yy <= y1; yy++) {
      for (let x = rowMinX[y]; x <= rowMaxX[y]; x++) {
        const idx = yy * width + x;
        if (textPixels[idx]) candidates[idx] = 0;
      }
    }
  }

  // Removing rows can split connected stamp/signature blobs; callers rebuild
  // components after this pass so scoring sees the cleaned mask.
}

function suppressDenseHorizontalInkBands(
  candidates: Uint8Array,
  width: number,
  height: number,
): void {
  const denseRows = findDenseHorizontalRows(candidates, width, height);
  if (denseRows.length === 0) return;

  for (const y of denseRows) {
    const y0 = Math.max(0, y - 2);
    const y1 = Math.min(height - 1, y + 2);

    for (let yy = y0; yy <= y1; yy++) {
      for (let x = 0; x < width; x++) {
        const idx = yy * width + x;
        if (!candidates[idx]) continue;
        if (hasLongStrokeSupport(candidates, width, height, x, yy)) continue;
        candidates[idx] = 0;
      }
    }
  }
}

function extractLongStrokeCandidateMask(
  candidates: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const strokes = new Uint8Array(width * height);
  const supportWindow = Math.min(
    140,
    Math.max(44, Math.round(height * 0.58)),
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!candidates[idx]) continue;

      const support = Math.max(
        countDirectionalSupport(candidates, width, height, x, y, supportWindow, 0),
        countDirectionalSupport(candidates, width, height, x, y, supportWindow, -0.42),
        countDirectionalSupport(candidates, width, height, x, y, supportWindow, 0.42),
      );

      if (support >= supportWindow * 0.38) {
        strokes[idx] = 1;
      }
    }
  }

  return restoreStrokeThickness(strokes, candidates, width, height);
}

function countDirectionalSupport(
  candidates: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  window: number,
  slope: number,
): number {
  let support = 0;
  const half = Math.floor(window / 2);

  for (let dy = -half; dy <= half; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= height) continue;

    const centerX = x + Math.round(dy * slope);
    let rowHasInk = false;
    for (
      let xx = Math.max(0, centerX - 2);
      xx <= Math.min(width - 1, centerX + 2);
      xx++
    ) {
      if (candidates[yy * width + xx]) {
        rowHasInk = true;
        break;
      }
    }

    if (rowHasInk) support++;
  }

  return support;
}

function restoreStrokeThickness(
  strokes: Uint8Array,
  candidates: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const restored = cloneMask(strokes);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!candidates[idx] || strokes[idx]) continue;

      let nearStroke = false;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy++) {
        for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++) {
          if (strokes[yy * width + xx]) {
            nearStroke = true;
            break;
          }
        }
        if (nearStroke) break;
      }

      if (nearStroke) restored[idx] = 1;
    }
  }

  return restored;
}

function findDenseHorizontalRows(
  candidates: Uint8Array,
  width: number,
  height: number,
): number[] {
  const rows: number[] = [];

  for (let y = 0; y < height; y++) {
    let count = 0;
    let minX = width;
    let maxX = -1;
    let runs = 0;
    let inRun = false;

    for (let x = 0; x < width; x++) {
      if (!candidates[y * width + x]) {
        inRun = false;
        continue;
      }
      count++;
      if (!inRun) {
        runs++;
        inRun = true;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }

    const span = maxX - minX + 1;
    const fillRatio = count / Math.max(span, 1);
    const isDenseTextBand =
      count >= Math.max(18, width * 0.12) &&
      span >= width * 0.42 &&
      runs >= 4 &&
      fillRatio >= 0.16;

    if (isDenseTextBand) rows.push(y);
  }

  return keepRowsInsideRepeatedTextBands(rows);
}

function keepRowsInsideRepeatedTextBands(rows: number[]): number[] {
  const kept: number[] = [];
  let group: number[] = [];

  for (const row of rows) {
    const previous = group[group.length - 1];
    if (group.length === 0 || row - previous <= 3) {
      group.push(row);
      continue;
    }

    if (group.length >= 3) kept.push(...group);
    group = [row];
  }

  if (group.length >= 3) kept.push(...group);
  return kept;
}

function hasLongStrokeSupport(
  candidates: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  const window = Math.max(26, Math.round(height * 0.24));
  const verticalSupport = countColumnSupport(candidates, width, height, x, y, window);
  if (verticalSupport >= window * 0.34) return true;

  const leftDiagonalSupport = countSlantedSupport(
    candidates,
    width,
    height,
    x,
    y,
    window,
    -1,
  );
  if (leftDiagonalSupport >= window * 0.3) return true;

  const rightDiagonalSupport = countSlantedSupport(
    candidates,
    width,
    height,
    x,
    y,
    window,
    1,
  );
  return rightDiagonalSupport >= window * 0.3;
}

function countColumnSupport(
  candidates: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  window: number,
): number {
  let support = 0;
  const half = Math.floor(window / 2);
  const y0 = Math.max(0, y - half);
  const y1 = Math.min(height - 1, y + half);

  for (let yy = y0; yy <= y1; yy++) {
    let rowHasStroke = false;
    for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++) {
      if (candidates[yy * width + xx]) {
        rowHasStroke = true;
        break;
      }
    }
    if (rowHasStroke) support++;
  }

  return support;
}

function countSlantedSupport(
  candidates: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  window: number,
  direction: -1 | 1,
): number {
  let support = 0;
  const half = Math.floor(window / 2);

  for (let step = -half; step <= half; step++) {
    const yy = y + step;
    if (yy < 0 || yy >= height) continue;
    const drift = Math.round((step / Math.max(window, 1)) * direction * 10);
    const centerX = x + drift;
    let rowHasStroke = false;
    for (
      let xx = Math.max(0, centerX - 2);
      xx <= Math.min(width - 1, centerX + 2);
      xx++
    ) {
      if (candidates[yy * width + xx]) {
        rowHasStroke = true;
        break;
      }
    }
    if (rowHasStroke) support++;
  }

  return support;
}

function scoreSignatureComponent(
  c: InkComponent,
  width: number,
  height: number,
): number {
  if (c.area < MIN_COMPONENT_AREA) return -4;

  let score = 0;
  const aspect = c.boxW / Math.max(c.boxH, 1);
  const elongation = Math.max(aspect, 1 / Math.max(aspect, 0.001));
  const relW = c.boxW / width;
  const relH = c.boxH / height;
  const redDominant = c.saturation > 35 && c.meanR > c.meanG + 22 && c.meanR > c.meanB + 22;
  const veryColorful = c.saturation > 70;
  const compactSmall = relW < 0.08 && relH < 0.12 && c.area < 120;
  const strokeLike = relH >= 0.22 || (elongation >= 4.2 && c.density <= 0.22);

  if (c.area >= 45) score += 1.4;
  if (c.area >= 120) score += 1.0;
  if (c.boxW >= MIN_SIGNATURE_COMPONENT_WIDTH) score += 0.8;
  if (c.boxH >= MIN_SIGNATURE_COMPONENT_HEIGHT) score += 0.5;
  if (relW >= 0.12) score += 1.8;
  if (relW >= 0.24) score += 1.4;
  if (relH >= 0.08) score += 0.8;
  if (elongation >= 1.8) score += 0.8;
  if (elongation >= 3.2) score += 1.0;
  if (c.density <= 0.45) score += 0.7;
  if (c.density <= 0.25 && c.area >= 45) score += 0.5;
  if (strokeLike) score += 1.2;

  if (compactSmall) score -= 2.0;
  if (c.textLineLike) score -= strokeLike ? 2.0 : 4.6;
  if (c.stampClusterLike) score -= strokeLike ? 1.5 : 4.2;
  if (c.density > 0.72 && c.area < 260) score -= 1.4;
  if (redDominant && (relW > 0.18 || relH > 0.18)) score -= 4.5;
  if (veryColorful && relW > 0.25 && relH > 0.18 && c.density < 0.28) score -= 2.0;

  return score;
}

function renderScoredComponentsToMask(
  candidates: Uint8Array,
  components: InkComponent[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  out.fill(255);

  const accepted = components.filter((c) => c.score >= 2.4);
  const fallback =
    accepted.length > 0
      ? accepted
      : components
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score || b.area - a.area)
          .slice(0, 3);

  const finalComponents = fallback.length > 0 ? fallback : [];
  for (const component of finalComponents) {
    for (const idx of component.pixels) out[idx] = 0;
  }

  // If scoring rejected everything, preserve the raw candidate mask.
  // Empty white masks can falsely match each other too easily.
  if (finalComponents.length === 0) {
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i]) out[i] = 0;
    }
  }

  return out;
}

interface RenderedMaskQuality {
  score: number;
  inkDensity: number;
  darkPixels: number;
  continuity: number;
  textContamination: number;
}

function measureRenderedSignatureMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): RenderedMaskQuality {
  const bbox = tightBoundingBox(mask, width, height);
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const aspect = bboxW / Math.max(bboxH, 1);
  const inkDensity = computeInkDensity(mask, width, bbox);
  const darkPixels = countDarkPixels(mask);

  if (darkPixels === 0) {
    return {
      score: -100,
      inkDensity: 0,
      darkPixels: 0,
      continuity: 0,
      textContamination: 1,
    };
  }

  const continuity = measureLongStrokeContinuity(mask, width, height, bbox);
  const textContamination = measureTextRowContamination(mask, width, height, bbox);

  let score = 0;
  if (bboxW >= width * 0.18) score += 1.6;
  if (bboxH >= height * 0.18) score += 1.6;
  if (aspect >= 0.28 && aspect <= 5.5) score += 1.2;
  if (inkDensity >= 0.015 && inkDensity <= 0.34) score += 2.4;
  if (inkDensity > 0.42) score -= 3.5;
  if (inkDensity < 0.006) score -= 3.5;

  score += continuity * 3.0;
  score -= textContamination * 4.2;

  return {
    score,
    inkDensity,
    darkPixels,
    continuity,
    textContamination,
  };
}

function countDarkPixels(mask: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < DARK_THRESHOLD) count++;
  }
  return count;
}

function measureLongStrokeContinuity(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const bboxH = bbox.maxY - bbox.minY + 1;
  if (bboxH <= 0) return 0;

  let best = 0;
  for (let x = bbox.minX; x <= bbox.maxX; x++) {
    let support = 0;
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
      let rowHasInk = false;
      for (let xx = Math.max(bbox.minX, x - 2); xx <= Math.min(bbox.maxX, x + 2); xx++) {
        if (mask[y * width + xx] < DARK_THRESHOLD) {
          rowHasInk = true;
          break;
        }
      }
      if (rowHasInk) support++;
    }
    if (support > best) best = support;
  }

  for (let x = bbox.minX; x <= bbox.maxX; x++) {
    let leftSupport = 0;
    let rightSupport = 0;
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
      const relY = y - bbox.minY;
      const leftX = x - Math.round(relY * 0.18);
      const rightX = x + Math.round(relY * 0.18);
      if (hasInkNear(mask, width, height, leftX, y, 2)) leftSupport++;
      if (hasInkNear(mask, width, height, rightX, y, 2)) rightSupport++;
    }
    best = Math.max(best, leftSupport, rightSupport);
  }

  return best / Math.max(bboxH, 1);
}

function measureTextRowContamination(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  let contaminatedRows = 0;
  const bboxH = bbox.maxY - bbox.minY + 1;

  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    let count = 0;
    let runs = 0;
    let inRun = false;

    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (mask[y * width + x] >= DARK_THRESHOLD) {
        inRun = false;
        continue;
      }
      count++;
      if (!inRun) {
        runs++;
        inRun = true;
      }
    }

    const rowFill = count / Math.max(bbox.maxX - bbox.minX + 1, 1);
    if (runs >= 4 && rowFill >= 0.16) contaminatedRows++;
  }

  return contaminatedRows / Math.max(bboxH, 1);
}

function hasInkNear(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
      if (mask[yy * width + xx] < DARK_THRESHOLD) return true;
    }
  }
  return false;
}

function maskToCanvas(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context alınamadı.");

  const imageData = ctx.createImageData(width, height);
  for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
    const v = mask[j];
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
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
