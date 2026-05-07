// Shared types for the regulations feed module. Mirrors the Prisma
// model shape but kept independent so client code can import without
// pulling in @prisma/client.

export type RegulationPriority = "critical" | "high" | "medium" | "low";

/** Yargı MCP karar finalizasyon durumu. Diğer kaynaklarda null. */
export type RegulationStatus = "kesinlesti" | "kesinlesmedi";

/** Kaynak kategorisi — Yargı MCP alt-tool'ları + birinci sınıf
 *  kaynaklar (resmi-gazete vs). UI chip filtresinde kullanılır. */
export type RegulationSourceTool =
  | "bedesten"
  | "anayasa-norm"
  | "anayasa-bireysel"
  | "kvkk"
  | "bddk"
  | "gib"
  | "rekabet"
  | "resmi-gazete"
  | "google-news";

export const SOURCE_TOOL_LABEL: Record<RegulationSourceTool, string> = {
  bedesten: "Bedesten (Yargıtay/Danıştay)",
  "anayasa-norm": "AYM — Norm Denetimi",
  "anayasa-bireysel": "AYM — Bireysel Başvuru",
  kvkk: "KVKK",
  bddk: "BDDK",
  gib: "GİB Özelge",
  rekabet: "Rekabet Kurumu",
  "resmi-gazete": "Resmî Gazete",
  "google-news": "Google Haberler",
};

export type RegulationSourceId =
  | "yargi-mcp"
  | "resmi-gazete"
  | "tcmb"
  | "bddk"
  | "kvkk"
  | "masak"
  | "gib"
  | "google-news";

export interface RegulationTopic {
  id: string;
  label: string;
  priority: RegulationPriority;
  /** Lowercase Turkish keywords used both for source query construction
   *  and for classifier matching against fetched item text. */
  keywords: string[];
  /** Preferred sources for this topic — the scan orchestrator hits
   *  these first when constructing per-source queries. Items found in
   *  other sources still classify into this topic if their content
   *  matches the keywords. */
  sources: readonly RegulationSourceId[];
  description: string;
}

export interface RegulationItemDTO {
  id: string;
  source: RegulationSourceId | string;
  externalId: string;
  title: string;
  summary: string;
  bodyExcerpt: string | null;
  url: string | null;
  publishedAt: string;
  fetchedAt: string;
  topics: string[];
  priority: RegulationPriority;
  /** Yargı MCP karar durumu — `kesinlesti` / `kesinlesmedi`. Diğer
   *  kaynaklarda null. */
  status: RegulationStatus | null;
  /** Kaynak kategorisi (bedesten, anayasa-bireysel, kvkk, ...). UI
   *  filtresinin grup anahtarı. */
  sourceTool: RegulationSourceTool | null;
  /** Per-user state surfaced when the API joins RegulationRead — null
   *  on raw queries that don't include the join. */
  readAt?: string | null;
  pinned?: boolean;
  /** Eşleşen Param Grup şirket id'leri (companies.ts). Mevzuat
   *  kaynaklarında genelde boş; Google Haberler kayıtlarında en az 1.
   *  UI "Haberler" sekmesinde şirket chip filtresi bunun üstünde
   *  çalışır. */
  companies: string[];
}

export interface RegulationFeedResponse {
  items: RegulationItemDTO[];
  total: number;
  /** ISO timestamp of the most recent successful scan completion across
   *  all sources, or null if the feed has never been scanned. */
  lastScannedAt: string | null;
}

/** Raw item shape produced by source adapters before classifier and
 *  upsert. Source adapters guarantee deduplication keys — externalId
 *  must be stable across rescans for the same publication. */
export interface ScannedRegulationCandidate {
  source: RegulationSourceId;
  externalId: string;
  title: string;
  summary: string;
  bodyExcerpt?: string;
  url?: string;
  publishedAt: Date;
  status?: RegulationStatus | null;
  sourceTool?: RegulationSourceTool | null;
  rawPayload?: unknown;
  /** Adapter eşleştirdiyse company id'leri taşır; classifier ek
   *  match yapar ve birleşim DB'ye yazılır. */
  companies?: string[];
}

export interface ScanSourceResult {
  source: RegulationSourceId;
  fetched: number;
  classified: number;
  durationMs: number;
  error: string | null;
}

export interface ScanResult {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  perSource: ScanSourceResult[];
  added: number;
  updated: number;
  skipped: number;
  /** Bu scan'de retention sınırını geçtiği için silinen kayıt sayısı. */
  pruned: number;
}
