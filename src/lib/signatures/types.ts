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

export interface ComparisonSignals {
  ssim: number;        // 0 (zıt) .. 1 (özdeş)
  phashHamming: number; // 0 (özdeş) .. 64 (tamamen farklı) — 64-bit hash
  aspectRatioDelta: number; // |ar1 - ar2| / max(ar1, ar2), 0 ideal
}

/** Bir referans örneğine karşı tek bir karşılaştırma sonucu. */
export interface SpecimenMatch {
  /** UI için okunur etiket ("Örnek 1", "Örnek 2", …) */
  label: string;
  /** Hangi referansın hangisi olduğunu izlemek için kararlı id. */
  specimenId: string;
  confidence: number;
  verdict: ComparisonVerdict;
  signals: ComparisonSignals;
}

export interface ComparisonResult {
  /** En iyi eşleşen örneğin güveni — top-line verdict bu. */
  confidence: number;
  verdict: ComparisonVerdict;
  /** En yüksek skoru veren örneğin id'si. */
  bestMatchSpecimenId: string;
  /** Her referans örneğine karşı sonuç (primary + additionals). */
  specimenMatches: SpecimenMatch[];
  /** Geriye dönük uyum için — bestMatch'in sinyalleri. */
  signals: ComparisonSignals;
  /** ISO tarih — ne zaman hesaplandı. */
  computedAt: string;
}

/** İmza sirküsünden birden fazla örnek alınabiliyor; her biri ayrı crop. */
export interface ReferenceSpecimen {
  id: string;
  crop: CropRegion;
  signatureDataUrl: string;
}

/** Store'daki tek karşılaştırma oturumu. */
export interface SignatureSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Sözleşme belgesinden alınan tek imza. */
  contract: SignatureSource;
  /** İmza sirküsü sayfası + birincil (primary) imza kırpımı. */
  reference: SignatureSource;
  /**
   * Referans sayfasından alınan EK imza örnekleri. Primary
   * (reference.crop) her zaman var; bunlar üstüne eklenir
   * (tipik: sirküsünde 2-3 örnek imza).
   */
  referenceSpecimens: ReferenceSpecimen[];
  /** Tüm kırpımlar hazırsa hesaplanır. */
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
