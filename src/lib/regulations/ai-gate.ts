// Regulations AI relevance gate.
//
// Sits between source adapters (MCP / RSS) and the persistence layer.
// A candidate that passed the cheap keyword classifier is sent here
// to verify that it _actually_ matters operationally for the Param
// Group — not just because a keyword fired. The gate produces an
// XAI verdict carrying the reasoning that the UI surfaces in
// "Param ile ilişki" blocks on each card.
//
// Failure mode: any error or timeout returns `null` (fail-open) so
// the orchestrator can decide policy (drop the candidate, OR keep it
// without a verdict — current policy: keep, item shows up without an
// AI relationship block).

import { generateJSON } from "@/lib/engine/gemini/client";
import { PARAM_GROUP_COMPANIES } from "./companies";
import { TOPIC_BY_ID } from "./topics";
import type { ScannedRegulationCandidate } from "./types";

const DEFAULT_MIN_CONFIDENCE = 0.6;
const DEFAULT_CONCURRENCY = 5;
const CALL_TIMEOUT_MS = 25_000;

export interface ParamRelation {
  /** 1-2 cümle Türkçe — kart üstündeki "Param ile ilişki" bloğunda
   *  birinci sınıf gösterilen metin. */
  summary: string;
  /** Etkilenen operasyon/iş alanları (örn. "e-para ihracı",
   *  "müşteri tanıma", "BNPL"). UI'da küçük chip listesi. */
  impactedOperations: string[];
  /** AI'nın doğruladığı grup şirketi id'leri. Adapter'dan gelen
   *  liste süzülerek alanı doldurur — false-positive'leri keser. */
  impactedCompanies: string[];
  /** "Neden kritik / yüksek / düşük" — UI'da detay panelinde gösterilir. */
  severityReason: string;
  suggestedAction: "review" | "monitor" | "no-action";
}

export interface AIVerdict {
  relevant: boolean;
  confidence: number;
  paramRelation: ParamRelation;
  model: string;
  evaluatedAt: string;
}

/** Gate'in upsert kararı için ihtiyaç duyduğu özet. */
export interface GateDecision {
  passed: boolean;
  reason: "ai_relevant" | "ai_low_confidence" | "ai_irrelevant" | "ai_failed" | "ai_disabled";
  verdict: AIVerdict | null;
}

interface GateConfig {
  enabled: boolean;
  minConfidence: number;
  concurrency: number;
  model: string;
}

function readConfig(): GateConfig {
  const enabled =
    (process.env.REGULATIONS_AI_GATE_ENABLED ?? "true").toLowerCase() !== "false";
  const minConfidence = clamp(
    Number(process.env.REGULATIONS_AI_GATE_MIN_CONFIDENCE ?? DEFAULT_MIN_CONFIDENCE),
    0,
    1,
  );
  const concurrency = Math.max(
    1,
    Math.min(
      20,
      Number(process.env.REGULATIONS_AI_GATE_CONCURRENCY ?? DEFAULT_CONCURRENCY),
    ),
  );
  const model =
    process.env.REGULATIONS_AI_GATE_MODEL ??
    process.env.NEXT_PUBLIC_GEMINI_MODEL ??
    "gemini-2.5-flash";
  return { enabled, minConfidence, concurrency, model };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function buildPrompt(candidate: ScannedRegulationCandidate): string {
  const companyLines = PARAM_GROUP_COMPANIES.map(
    (c) => `- ${c.id}: ${c.displayName} — ${c.description}`,
  ).join("\n");
  const topicHints = (candidate as ScannedRegulationCandidate & {
    topics?: string[];
  }).topics
    ? ""
    : "";
  const allowedCompanyIds = PARAM_GROUP_COMPANIES.map((c) => c.id).join(", ");
  const adapterCompanies = (candidate.companies ?? []).join(", ") || "yok";
  const topicCatalogue = Object.values(TOPIC_BY_ID)
    .map((t) => `- ${t.id}: ${t.label} — ${t.description}`)
    .join("\n");

  const body = [
    candidate.title,
    candidate.summary,
    candidate.bodyExcerpt ?? "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);

  return `Sen Param Holding'in mevzuat ve iş etkisi takip uzmanısın. Aşağıdaki düzenleme/haber Param Grubu için _operasyonel_ olarak gerçekten anlamlı mı, onu değerlendireceksin.

Sadece şirket adı geçtiği veya yüzeysel bir keyword eşleştiği için "alakalı" deme — somut bir iş etkisi (ürün, izin, süreç, müşteri, raporlama, vergi, veri koruma vb.) varsa relevant=true. Yoksa relevant=false.

# Param Grubu Şirketleri
${companyLines}

# Mevzuat Konu Taksonomisi (referans)
${topicCatalogue}

# Adapter'ın işaret koyduğu şirketler
${adapterCompanies}

# Değerlendirilecek metin
"""
${body}
"""${topicHints}

# Beklenen JSON çıktı
{
  "relevant": boolean,
  "confidence": number,        // 0..1, gerçek bir iş etkisine ne kadar eminsin
  "paramRelation": {
    "summary": string,         // 1-2 cümle Türkçe. "Bu düzenleme şu açıdan Param/Kredim/...'i etkiler" şeklinde somut. Jargon yok, kullanıcı tek bakışta anlasın.
    "impactedOperations": string[], // örn ["e-para ihracı","BNPL kredi süreci","müşteri tanıma","ödeme sistemi izni"]. Boş olabilir.
    "impactedCompanies": string[],  // sadece şu id'lerden biri/birkaçı: ${allowedCompanyIds}. Etkilenmiyorsa boş [].
    "severityReason": string,  // tek cümle, "neden bu seviye"
    "suggestedAction": "review" | "monitor" | "no-action"
  }
}

Yalnız JSON döndür, başka metin yok.`;
}

interface RawAIResponse {
  relevant: boolean;
  confidence: number;
  paramRelation: ParamRelation;
}

function sanitizeVerdict(
  raw: RawAIResponse,
  model: string,
): AIVerdict {
  const allowedCompanyIds = new Set(
    PARAM_GROUP_COMPANIES.map((c) => c.id),
  );
  const allowedActions: ParamRelation["suggestedAction"][] = [
    "review",
    "monitor",
    "no-action",
  ];
  const action = allowedActions.includes(
    raw.paramRelation?.suggestedAction as ParamRelation["suggestedAction"],
  )
    ? (raw.paramRelation.suggestedAction as ParamRelation["suggestedAction"])
    : "monitor";
  return {
    relevant: Boolean(raw.relevant),
    confidence: clamp(Number(raw.confidence ?? 0), 0, 1),
    paramRelation: {
      summary: String(raw.paramRelation?.summary ?? "").slice(0, 600),
      impactedOperations: Array.isArray(raw.paramRelation?.impactedOperations)
        ? raw.paramRelation.impactedOperations
            .map((s: unknown) => String(s).trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
      impactedCompanies: Array.isArray(raw.paramRelation?.impactedCompanies)
        ? raw.paramRelation.impactedCompanies
            .map((s: unknown) => String(s).trim())
            .filter((id: string) => allowedCompanyIds.has(id))
        : [],
      severityReason: String(raw.paramRelation?.severityReason ?? "").slice(
        0,
        400,
      ),
      suggestedAction: action,
    },
    model,
    evaluatedAt: new Date().toISOString(),
  };
}

async function callGate(
  candidate: ScannedRegulationCandidate,
  model: string,
): Promise<AIVerdict> {
  const prompt = buildPrompt(candidate);
  const raw = await Promise.race<RawAIResponse>([
    generateJSON<RawAIResponse>(prompt),
    new Promise<RawAIResponse>((_, reject) =>
      setTimeout(
        () => reject(new Error(`AI gate timeout after ${CALL_TIMEOUT_MS}ms`)),
        CALL_TIMEOUT_MS,
      ),
    ),
  ]);
  return sanitizeVerdict(raw, model);
}

/** Tek bir aday için gate kararı. Hata durumunda fail-open (passed=true,
 *  verdict=null) — orchestrator policy karar verir. */
export async function gateOne(
  candidate: ScannedRegulationCandidate,
): Promise<GateDecision> {
  const cfg = readConfig();
  if (!cfg.enabled) {
    return { passed: true, reason: "ai_disabled", verdict: null };
  }
  try {
    const verdict = await callGate(candidate, cfg.model);
    if (!verdict.relevant) {
      return { passed: false, reason: "ai_irrelevant", verdict };
    }
    if (verdict.confidence < cfg.minConfidence) {
      return { passed: false, reason: "ai_low_confidence", verdict };
    }
    return { passed: true, reason: "ai_relevant", verdict };
  } catch {
    // Fail-open: AI ulaşılamazsa kullanıcı haberi/mevzuatı kaybetmesin.
    // Orchestrator bu item'ı verdict'siz kaydeder.
    return { passed: true, reason: "ai_failed", verdict: null };
  }
}

/** Concurrency-limited paralel runner. */
export async function gateAll(
  candidates: ScannedRegulationCandidate[],
): Promise<GateDecision[]> {
  const cfg = readConfig();
  if (!cfg.enabled || candidates.length === 0) {
    return candidates.map(() => ({
      passed: true,
      reason: "ai_disabled" as const,
      verdict: null,
    }));
  }

  const results: GateDecision[] = new Array(candidates.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(cfg.concurrency, candidates.length) }, () =>
    (async () => {
      while (true) {
        const i = cursor++;
        if (i >= candidates.length) return;
        results[i] = await gateOne(candidates[i]);
      }
    })(),
  );
  await Promise.all(workers);
  return results;
}
