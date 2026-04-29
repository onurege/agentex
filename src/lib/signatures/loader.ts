// ============================================================
// Signatures — File Loader
// ============================================================
//
// Client-side yükleme: PDF → ilk sayfa canvas render → data URL.
// PNG/JPG → doğrudan data URL. Tüm işlem tarayıcıda olur; dosya
// sunucuya çıkmaz. ML/OCR yok; kullanıcı sonrasında bölgeyi
// manuel kırpar.
// ============================================================

import type { SignatureSource } from "./types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — PDF/PNG/JPG için makul üst sınır

export class SignatureLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureLoadError";
  }
}

export async function loadFileToSource(
  file: File,
): Promise<SignatureSource> {
  if (file.size > MAX_BYTES) {
    throw new SignatureLoadError(
      `Dosya 10 MB sınırını aşıyor (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    );
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") {
    return loadPdf(file);
  }
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return loadImage(file);
  }
  throw new SignatureLoadError(
    "Desteklenmeyen format. PDF, PNG, JPG veya WebP yükleyin.",
  );
}

async function loadImage(file: File): Promise<SignatureSource> {
  const dataUrl = await readAsDataUrl(file);
  const { width, height } = await imageDimensions(dataUrl);
  return {
    fileName: file.name,
    fileType: "image",
    fileSize: file.size,
    pageDataUrl: dataUrl,
    pageWidth: width,
    pageHeight: height,
    crop: null,
    rawCropDataUrl: null,
    signatureDataUrl: null,
    processedAspectRatio: null,
    inkDensity: null,
    rawText: null,
  };
}

// pdfjs-dist 5.x pure-ESM → Next.js 14 webpack'in ESM sarmalama yolunda
// "Object.defineProperty called on non-object" TypeError'ı üretiyor
// (__webpack_require__.r(exports)'ta exports primitive geliyor). Webpack'i
// tamamen bypass ediyoruz: kütüphaneyi public/ altından browser ESM loader
// ile doğrudan yükleyip webpack'e hiç göstermiyoruz.
//
// webpackIgnore magic comment → webpack bu import'u bundle'a katmaz.
// İmza hâlâ tarayıcıdan çıkmıyor (tüm asset'ler same-origin, CDN yok).
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = (
      // @ts-expect-error — webpackIgnore: webpack dokunmuyor, TS de resolve edemiyor; runtime'da browser ESM loader'ı çözer
      import(/* webpackIgnore: true */ "/pdf.min.mjs") as Promise<
        typeof import("pdfjs-dist")
      >
    ).then((mod) => {
      if (!mod.GlobalWorkerOptions.workerSrc) {
        mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return mod;
    });
  }
  return pdfjsPromise;
}

// Pre-check extraction needs only the structured first-page fields
// (ÜNVAN, VKN, ticaret sicili, yetki türü, temsil süresi, sirkü tarihi).
// Pages 2+ in a sirkü are usually a Ticaret Sicili Gazetesi annex —
// dense, low-signal noise for our regex; capping the scan keeps the
// pre-check trigger snappy on multi-page filings.
const PRECHECK_TEXT_PAGE_LIMIT = 2;

async function loadPdf(file: File): Promise<SignatureSource> {
  const arrayBuffer = await readAsArrayBuffer(file);
  const pdfjsLib = await getPdfjs();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Run page render and text extraction concurrently. Both consume the
  // same pdf object but pdf.js handles concurrent getPage / getTextContent
  // calls fine, and on a 3-page sirkü this halves total wait time before
  // /api/signatures/precheck can fire.
  const [dataUrl, rawText] = await Promise.all([
    renderFirstPageToDataUrl(page),
    extractPdfText(pdf, PRECHECK_TEXT_PAGE_LIMIT).catch(() => null),
  ]);

  const viewport = page.getViewport({ scale: 2 });

  return {
    fileName: file.name,
    fileType: "pdf",
    fileSize: file.size,
    pageDataUrl: dataUrl,
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    crop: null,
    rawCropDataUrl: null,
    signatureDataUrl: null,
    processedAspectRatio: null,
    inkDensity: null,
    rawText,
  };
}

type PdfPage = import("pdfjs-dist").PDFPageProxy;

async function renderFirstPageToDataUrl(page: PdfPage): Promise<string> {
  // 2x scale — imza bölgesinin piksel çözünürlüğü için yeterli detay.
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new SignatureLoadError("Canvas 2D context alınamadı.");
  }
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

async function extractPdfText(
  pdf: import("pdfjs-dist").PDFDocumentProxy,
  pageLimit: number,
): Promise<string> {
  const pageCount = Math.min(pdf.numPages, pageLimit);
  // Fan out getPage / getTextContent across the capped page range so
  // text extraction completes in roughly the time of the slowest single
  // page rather than the sum of all pages.
  const pageTexts = await Promise.all(
    Array.from({ length: pageCount }, async (_, i) => {
      const page = await pdf.getPage(i + 1);
      const content = await page.getTextContent();
      const lineMap = new Map<number, string[]>();
      for (const item of content.items) {
        if (typeof (item as { str?: unknown }).str !== "string") continue;
        const str = (item as { str: string }).str;
        // Group items by their y position so the visual line order survives;
        // pdf.js returns items in scan order which is usually left-to-right
        // but column-broken sirkü filings interleave label and value blocks.
        const transform = (item as { transform?: number[] }).transform;
        const y = transform ? Math.round(transform[5]) : 0;
        const key = -y;
        const arr = lineMap.get(key) ?? [];
        arr.push(str);
        lineMap.set(key, arr);
      }
      const orderedKeys = Array.from(lineMap.keys()).sort((a, b) => a - b);
      return orderedKeys
        .map((k) => (lineMap.get(k) ?? []).join(" ").trim())
        .filter(Boolean)
        .join("\n");
    }),
  );
  return pageTexts.join("\n\n");
}

// --- Helpers ---------------------------------------------------------------

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Dosya okunamadı."));
    r.readAsDataURL(file);
  });
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(new Error("Dosya okunamadı."));
    r.readAsArrayBuffer(file);
  });
}

function imageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Görüntü yüklenemedi."));
    img.src = dataUrl;
  });
}
