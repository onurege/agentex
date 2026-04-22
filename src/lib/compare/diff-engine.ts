// ============================================================
// Compare Module — Deterministic Diff Engine (Faz 2)
// ============================================================
//
// Clause-level structural diff. Matches CompareSections across two
// contract versions by clauseRef, classifies each divergence into
// one of CompareFindingType, and scores risk heuristically. No
// LLM calls — everything here is reproducible. Party-impact is
// always neutral/mutual_risk; real reasoning (and narrative impact
// copy) is deferred to the Faz 3 Gemini agent, which will replace
// the heuristic summaries in-place.
// ============================================================

import {
  deriveStats,
  type CompareDocumentMeta,
  type CompareFinding,
  type CompareFindingType,
  type ComparePartyImpact,
  type CompareRiskLevel,
  type CompareRun,
} from "./types";
import type { CompareSection } from "./parse";

export interface DiffEngineInput {
  v1: CompareDocumentMeta;
  v1Sections: CompareSection[];
  v2: CompareDocumentMeta;
  v2Sections: CompareSection[];
}

export function runDiffEngine(input: DiffEngineInput): CompareRun {
  const findings = buildFindings(input.v1Sections, input.v2Sections);
  return {
    id: generateRunId(),
    createdAt: new Date().toISOString(),
    status: "complete",
    v1: input.v1,
    v2: input.v2,
    findings,
    stats: deriveStats(findings),
  };
}

// --- Matching & iteration --------------------------------------------------

function buildFindings(
  v1: CompareSection[],
  v2: CompareSection[],
): CompareFinding[] {
  const v1Map = indexByClauseRef(v1);
  const v2Map = indexByClauseRef(v2);

  const refSet = new Set<string>();
  v1Map.forEach((_, k) => refSet.add(k));
  v2Map.forEach((_, k) => refSet.add(k));
  const allRefs = Array.from(refSet).sort(compareClauseRefs);

  const findings: CompareFinding[] = [];
  let idx = 0;

  for (const ref of allRefs) {
    const a = v1Map.get(ref);
    const b = v2Map.get(ref);
    idx++;
    const id = `cmp_${idx.toString(36)}`;

    if (a && !b) {
      findings.push(buildRemovedFinding(id, ref, a));
    } else if (!a && b) {
      findings.push(buildAddedFinding(id, ref, b));
    } else if (a && b) {
      const maybe = classifyEdit(id, ref, a, b);
      if (maybe) findings.push(maybe);
    }
  }

  return findings;
}

function indexByClauseRef(
  sections: CompareSection[],
): Map<string, CompareSection> {
  const map = new Map<string, CompareSection>();
  for (const s of sections) {
    // First occurrence wins — stable across duplicate refs.
    if (!map.has(s.clauseRef)) map.set(s.clauseRef, s);
  }
  return map;
}

/** Order clauseRefs numerically so "Madde 3.10" follows "Madde 3.2". */
function compareClauseRefs(a: string, b: string): number {
  const na = extractRefNumbers(a);
  const nb = extractRefNumbers(b);
  const len = Math.max(na.length, nb.length);
  for (let i = 0; i < len; i++) {
    const ai = na[i] ?? -1;
    const bi = nb[i] ?? -1;
    if (ai !== bi) return ai - bi;
  }
  return a.localeCompare(b, "tr");
}

function extractRefNumbers(ref: string): number[] {
  return (ref.match(/\d+/g) ?? []).map((n) => parseInt(n, 10));
}

// --- Change classification -------------------------------------------------

function classifyEdit(
  id: string,
  ref: string,
  a: CompareSection,
  b: CompareSection,
): CompareFinding | null {
  const normA = normalizeForCompare(a.text);
  const normB = normalizeForCompare(b.text);

  if (normA === normB) return null;

  if (stripAllWhitespaceLower(a.text) === stripAllWhitespaceLower(b.text)) {
    return makeFinding({
      id,
      ref,
      title: b.title ?? a.title,
      type: "cosmetic",
      risk: "low",
      partyImpact: "neutral",
      v1Text: a.text,
      v2Text: b.text,
      summary: `${ref} — biçimsel düzeltme (büyük/küçük harf veya boşluk).`,
      impact:
        "Hukuki içerik aynı; yalnızca yazım/biçim düzeyinde bir değişiklik söz konusu. Ayrıca inceleme gerekmez.",
    });
  }

  const dissim = tokenJaccardDissimilarity(normA, normB);

  if (dissim >= 0.5) {
    return makeFinding({
      id,
      ref,
      title: b.title ?? a.title,
      type: "material",
      risk: "high",
      partyImpact: "mutual_risk",
      v1Text: a.text,
      v2Text: b.text,
      summary: `${ref} — madde büyük ölçüde yeniden kaleme alındı.`,
      impact:
        "Metnin büyük bölümü değiştirilmiş. Yükümlülüklerin anlamı korundu mu, kapsamı daraldı mı genişledi mi — hukuk ekibince teyit edilmelidir.",
    });
  }

  const numsA = extractNumericTokens(a.text);
  const numsB = extractNumericTokens(b.text);
  const numericChanged =
    numsA.length !== numsB.length || numsA.some((n, i) => n !== numsB[i]);

  if (numericChanged) {
    return makeFinding({
      id,
      ref,
      title: b.title ?? a.title,
      type: "numeric_change",
      risk: "high",
      partyImpact: "mutual_risk",
      v1Text: a.text,
      v2Text: b.text,
      summary: `${ref} — madde içindeki sayısal değer(ler) değişti.`,
      impact:
        "Süre, tutar veya oran gibi ölçülebilir bir değer güncellendi. Ticari etkisi (nakit akışı, tazminat, bildirim süresi vb.) ayrıca hesaplanmalıdır.",
    });
  }

  const lenDelta =
    Math.abs(a.text.length - b.text.length) /
    Math.max(a.text.length, b.text.length, 1);
  const substantial = lenDelta > 0.3 || dissim > 0.25;

  return makeFinding({
    id,
    ref,
    title: b.title ?? a.title,
    type: "reworded",
    risk: substantial ? "medium" : "low",
    partyImpact: substantial ? "mutual_risk" : "neutral",
    v1Text: a.text,
    v2Text: b.text,
    summary: substantial
      ? `${ref} — madde kapsamlı biçimde yeniden yazıldı.`
      : `${ref} — madde kısmen yeniden yazıldı.`,
    impact: substantial
      ? "Anlam kaymış olabilir; yükümlülük kapsamının iki versiyon arasında nasıl değiştiği hukuk ekibince doğrulanmalıdır."
      : "Küçük ifade değişikliği. Anlamsal etkisi sınırlı görünüyor; yine de referans verilen terimler kontrol edilmelidir.",
  });
}

function buildRemovedFinding(
  id: string,
  ref: string,
  a: CompareSection,
): CompareFinding {
  return makeFinding({
    id,
    ref,
    title: a.title,
    type: "removed",
    risk: "high",
    partyImpact: "mutual_risk",
    v1Text: a.text,
    v2Text: null,
    summary: `${ref} — madde yeni versiyondan kaldırıldı.`,
    impact:
      "Maddenin tamamen çıkarılması, ilgili yükümlülük veya korumanın kalktığı anlamına gelebilir. Sözleşmenin geri kalanındaki çapraz referanslar taranmalıdır.",
  });
}

function buildAddedFinding(
  id: string,
  ref: string,
  b: CompareSection,
): CompareFinding {
  return makeFinding({
    id,
    ref,
    title: b.title,
    type: "added",
    risk: "medium",
    partyImpact: "mutual_risk",
    v1Text: null,
    v2Text: b.text,
    summary: `${ref} — yeni madde eklendi.`,
    impact:
      "Yeni bir yükümlülük veya hak tanımlanıyor. İç süreçlerin ve uyumluluk kontrollerinin bu maddeyi karşıladığı doğrulanmalıdır.",
  });
}

interface MakeFindingArgs {
  id: string;
  ref: string;
  title?: string;
  type: CompareFindingType;
  risk: CompareRiskLevel;
  partyImpact: ComparePartyImpact;
  v1Text: string | null;
  v2Text: string | null;
  summary: string;
  impact: string;
}

function makeFinding(a: MakeFindingArgs): CompareFinding {
  return {
    id: a.id,
    clauseRef: a.ref,
    clauseTitle: a.title,
    type: a.type,
    riskLevel: a.risk,
    v1Text: a.v1Text,
    v2Text: a.v2Text,
    summary: a.summary,
    impact: a.impact,
    partyImpact: a.partyImpact,
  };
}

// --- Text helpers ----------------------------------------------------------

function normalizeForCompare(s: string): string {
  return s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

function stripAllWhitespaceLower(s: string): string {
  return s.toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
}

function extractNumericTokens(s: string): string[] {
  return s.match(/\d+[.,]?\d*/g)?.map((t) => t.replace(",", ".")) ?? [];
}

function tokenize(s: string): string[] {
  return s
    .toLocaleLowerCase("tr-TR")
    .split(/[^A-Za-zÇĞİıÖŞÜçğöşü0-9]+/)
    .filter((t) => t.length >= 2);
}

function tokenJaccardDissimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  const union = ta.size + tb.size - inter;
  if (union === 0) return 0;
  return 1 - inter / union;
}

function generateRunId(): string {
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
