// ============================================================
// Signatures Module — Types
// ============================================================
//
// İki imza görüntüsü arasında hızlı, deterministik görsel
// karşılaştırma. ML yok; SSIM + pHash sinyalleri birleştirilir.
// Çıktı adli delil değildir — ilk filtre amaçlıdır.
// ============================================================

/** Bir belgeden yüklenen ham görüntü + kullanıcı kırpımı. */
export interface SignatureSource {
  /** Dosya adı (UI + debug). */
  fileName: string;
  fileType: "pdf" | "image";
  fileSize: number;
  /** Görüntüye çevrilmiş sayfa (PDF ise ilk sayfa) — data URL. */
  pageDataUrl: string | null;
  /** Sayfa doğal boyutu (kırpım koordinatı bunun üstüne düşer). */
  pageWidth: number;
  pageHeight: number;
  /** Kullanıcının çizdiği kırpım; x/y/w/h piksel cinsinden. */
  crop: CropRegion | null;
  /** Kırpılan + preprocessed imza görüntüsü (data URL). */
  signatureDataUrl: string | null;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ComparisonVerdict = "match" | "borderline" | "no_match";

export interface ComparisonResult {
  /** 0-1 arası normalize edilmiş tek güven skoru. */
  confidence: number;
  verdict: ComparisonVerdict;
  /** Bireysel sinyaller — debugging / transparency için UI'da gösterilir. */
  signals: {
    ssim: number;        // 0 (zıt) .. 1 (özdeş)
    phashHamming: number; // 0 (özdeş) .. 64 (tamamen farklı) — 64-bit hash
    aspectRatioDelta: number; // |ar1 - ar2| / max(ar1, ar2), 0 ideal
  };
  /** ISO tarih — ne zaman hesaplandı. */
  computedAt: string;
}

/** Store'daki tek karşılaştırma oturumu. */
export interface SignatureSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Sözleşme belgesinden alınan imza. */
  contract: SignatureSource;
  /** İmza sirküsünden alınan referans imza. */
  reference: SignatureSource;
  /** İki kırpım da hazırsa hesaplanır. */
  result: ComparisonResult | null;
}

export const EMPTY_SOURCE: SignatureSource = {
  fileName: "",
  fileType: "image",
  fileSize: 0,
  pageDataUrl: null,
  pageWidth: 0,
  pageHeight: 0,
  crop: null,
  signatureDataUrl: null,
};
