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
    signatureDataUrl: null,
  };
}

async function loadPdf(file: File): Promise<SignatureSource> {
  const arrayBuffer = await readAsArrayBuffer(file);
  const pdfjsLib = await import("pdfjs-dist");
  // Bundled worker'a gerek yok; workerSrc'i boş set ederek fake worker
  // modu etkin olur (ingestion modülündeki pattern ile aynı).
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // 2x scale — imza bölgesinin piksel çözünürlüğü için yeterli detay.
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new SignatureLoadError("Canvas 2D context alınamadı.");
  }

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;

  const dataUrl = canvas.toDataURL("image/png");

  return {
    fileName: file.name,
    fileType: "pdf",
    fileSize: file.size,
    pageDataUrl: dataUrl,
    pageWidth: canvas.width,
    pageHeight: canvas.height,
    crop: null,
    signatureDataUrl: null,
  };
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
