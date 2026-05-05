// ============================================================
// Chief Pass — Rebuttal-aware synthesis and verdict
// ============================================================
//
// Consumes:
//   - agent observations
//   - disagreement detection results
//   - rebuttal round results
// Produces the final executive verdict with structured
// resolved/unresolved disagreements and position changes.
// ============================================================

import type { AgentPassResult } from "./agent-pass";
import type { DisagreementPassResult } from "./disagreement-pass";
import type { RebuttalPassResult } from "./rebuttal-pass";
import type {
  ArbitratedEdit,
  ArbitrationResolution,
  EditProposal,
  EditSeverity,
  EditType,
} from "../redline/types";

// --- Output ---

export interface ChiefPassPerspective {
  agentId: string;
  agentName: string;
  avatar: string;
  position: string;
}

export interface ResolvedDisagreement {
  topic: string;
  agentA: string;
  agentB: string;
  resolution: string;
}

export interface UnresolvedDisagreement {
  topic: string;
  agentA: string;
  agentB: string;
  reason: string;
}

export interface PositionChange {
  agentId: string;
  agentName: string;
  topic: string;
  previousStance: string;
  updatedStance: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ChiefPassResult {
  synthesis: string;
  summary: string;
  riskLevel: "high" | "medium" | "low";
  confidenceLevel: ConfidenceLevel;
  decisions: string[];
  actionItems: string[];
  agentPerspectives: ChiefPassPerspective[];
  resolvedDisagreements: ResolvedDisagreement[];
  unresolvedDisagreements: UnresolvedDisagreement[];
  positionChanges: PositionChange[];
  /**
   * Faz 4: canonical edit list after chief arbitration.
   * Empty array when agents emitted no proposals or chief rejected all.
   * orphan_unmatched is stamped later by the API route after running
   * the DOCX clause-matcher.
   */
  arbitratedEdits: ArbitratedEdit[];
}

// --- Prompt builder ---

export function buildChiefPassPrompt(
  agentResults: AgentPassResult[],
  disagreementResult: DisagreementPassResult,
  rebuttalResult: RebuttalPassResult | null,
  documentFileName: string,
  contextNotes: string,
  stanceDirective: string,
): string {
  const agentSummaries = agentResults.map((ar) => {
    return `### ${ar.agentName} (${ar.agentId}, avatar: ${ar.avatar})
Ana endişe: ${ar.keyConcern}
Önerilen aksiyon: ${ar.suggestedAction}
Genel pozisyon: ${ar.overallPosition}
Gözlem sayısı: ${ar.observations.length} (${ar.observations.filter((o) => o.severity === "critical").length} kritik)`;
  }).join("\n\n");

  const disagreementText = disagreementResult.disagreements.length > 0
    ? disagreementResult.disagreements.map((d) =>
        `- ${d.topic}: ${d.agentAName} ("${d.agentAPosition}") vs ${d.agentBName} ("${d.agentBPosition}") [${d.severity}]`
      ).join("\n")
    : "Görüş ayrılığı tespit edilmedi.";

  const consensusText = disagreementResult.consensusPoints.length > 0
    ? disagreementResult.consensusPoints.map((p) => `- ${p}`).join("\n")
    : "Belirgin uzlaşı noktası yok.";

  // Rebuttal section — critical for informed synthesis
  let rebuttalText = "Karşılıklı yanıt turu yapılmadı.";
  if (rebuttalResult && rebuttalResult.rebuttals.length > 0) {
    rebuttalText = rebuttalResult.rebuttals.map((r) => {
      const stanceLabel = {
        defend: "savundu",
        challenge: "sorguladı",
        concede: "kısmen kabul etti",
        refine: "pozisyonunu güncelledi",
      }[r.stance] ?? r.stance;
      return `- ${r.speakingAgentName} → ${r.targetAgentName} (${r.topic}): "${r.message}" [${stanceLabel}]`;
    }).join("\n");
  }

  // Edit proposals grouped by clauseRef so the chief sees conflicts side-by-side.
  const proposalsByClause = new Map<string, EditProposal[]>();
  for (const ar of agentResults) {
    for (const p of ar.editProposals) {
      const list = proposalsByClause.get(p.clauseRef) ?? [];
      list.push(p);
      proposalsByClause.set(p.clauseRef, list);
    }
  }
  const editProposalsText = proposalsByClause.size === 0
    ? "Ajanlar edit önerisi üretmedi."
    : Array.from(proposalsByClause.entries()).map(([clause, list]) => {
        const items = list.map((p) =>
          `  - [${p.id}] ${p.agentId} · ${p.editType} · severity=${p.severity}` +
          (p.originalText ? `\n    Eski: "${p.originalText.slice(0, 200)}"` : "") +
          `\n    Yeni: "${p.proposedText.slice(0, 200)}"` +
          `\n    Gerekçe: ${p.rationale.slice(0, 200)}`,
        ).join("\n");
        return `### ${clause}\n${items}`;
      }).join("\n\n");

  return `Sen AI Boardroom Baş Ajanısın. Uzman ajanların değerlendirmelerini, anlaşmazlıklarını ve karşılıklı yanıtlarını sentezleyerek nihai kurul kararını oluştur.

${stanceDirective}

## BELGE
Dosya: ${documentFileName}
${contextNotes ? `Bağlam: ${contextNotes}` : ""}

## AJAN DEĞERLENDİRMELERİ

${agentSummaries}

## GÖRÜŞ AYRILIKLARI

${disagreementText}

## UZLAŞI NOKTALARI

${consensusText}

## KARŞILIKLI YANITLAR (REBUTTAL TURU)

${rebuttalText}

## EDIT ÖNERİLERİ (CLAUSE BAZINDA GRUPLANMIŞ)

${editProposalsText}

## GÖREV

Tüm değerlendirmeleri, anlaşmazlıkları ve KARŞILIKLI YANITLARI dikkate alarak nihai kurul kararını oluştur.

ÖNEMLİ: Karşılıklı yanıt turundaki bilgi, nihai kararı doğrudan etkilemelidir:
- Bir ajan pozisyonunu kabul ettiyse (concede), nihai perspektifi buna göre yumuşamalı
- Bir ajan pozisyonunu güncellediyse (refine), güncel pozisyonu kullan
- Bir anlaşmazlık yanıtlarla çözüldüyse, resolvedDisagreements'a ekle
- Bir anlaşmazlık hâlâ devam ediyorsa, unresolvedDisagreements'a ekle
- Çözülen anlaşmazlıklar karar güvenini artırmalı
- Çözülemeyen anlaşmazlıklar kararda belirsizlik olarak yansımalı

Ek olarak: Her clauseRef için ajan edit önerilerini **arbitrate** et. İki veya daha fazla ajan aynı clause'a öneri yaptıysa — kabul et (accepted_a / accepted_b), birleştir (merged), tamamen yeniden yaz (rewritten) veya reddet (rejected_all). Sadece tek öneri varsa onu da değerlendir ve gerekirse iyileştir.

ÖNEMLİ — severity kategorilerini kaybetme:
- Gelen proposal severity'si **info** ise (yazım/gramer/tutarlılık düzeltmesi), düşürme veya reddetme. Bu edit'ler redline'ın önemli bir kısmını oluşturur; her biri belgeye somut değer katar. accept veya merge et.
- finalSeverity genellikle kaynak proposal severity'sini korumalı. info → warning'e yükseltme. warning → critical yalnızca başka ajanın rebuttal'ı veya cross-clause etki açıkça gösteriyorsa gerekçelendirilebilir.
- Proaktif severity düşürme yapma — ajan critical dediyse ve ciddi bir argüman sundu ise, critical kalmalı.

Aşağıdaki JSON yapısında yanıt ver:

{
  "synthesis": "Kurul sentez açıklaması, karşılıklı yanıtları dikkate alarak (2-3 cümle)",
  "summary": "Yönetici özeti (2-3 cümle)",
  "riskLevel": "high | medium | low",
  "confidenceLevel": "high | medium | low",
  "decisions": ["Karar 1", "Karar 2"],
  "actionItems": ["1. Aksiyon maddesi", "2. Aksiyon maddesi"],
  "agentPerspectives": [
    { "agentId": "id", "agentName": "Kısa İsim", "avatar": "emoji", "position": "Yanıt turu sonrası son pozisyon (1 cümle)" }
  ],
  "resolvedDisagreements": [
    { "topic": "Konu", "agentA": "Ajan A", "agentB": "Ajan B", "resolution": "Nasıl çözüldü (1 cümle)" }
  ],
  "unresolvedDisagreements": [
    { "topic": "Konu", "agentA": "Ajan A", "agentB": "Ajan B", "reason": "Neden çözülemedi (1 cümle)" }
  ],
  "positionChanges": [
    { "agentId": "id", "agentName": "İsim", "topic": "Konu", "previousStance": "Önceki pozisyon", "updatedStance": "Güncel pozisyon" }
  ],
  "arbitratedEdits": [
    {
      "clauseRef": "Madde X.Y (proposal'lardan birinin clauseRef'i ile birebir eşleşmeli)",
      "editType": "replace_clause | replace_phrase | insert_after | delete_clause",
      "originalText": "replace_phrase için — proposal'lardakiyle birebir",
      "finalText": "Kurulun nihai metni",
      "sourceProposals": ["prop-agentId-0", "prop-agentId-1"],
      "arbitrationNote": "Kararın kısa açıklaması (1-2 cümle, neden bu çözüm)",
      "resolution": "accepted_a | accepted_b | merged | rewritten | rejected_all",
      "finalSeverity": "critical | warning | info"
    }
  ]
}

KURALLAR:
- Her ajanın perspektifini yanıt turu SONRASI pozisyonuna göre özetle
- Risk seviyesini ajan bulgularının ciddiyetine ve çözüm durumuna göre belirle
- Çözülen anlaşmazlıklar daha düşük risk, çözülemeyen daha yüksek risk anlamına gelir
- confidenceLevel: tüm ajanlar uzlaştıysa "high", kısmen çözüldüyse "medium", ciddi çözülemeyen anlaşmazlık varsa "low"
- En az 2 karar ve 2 aksiyon maddesi üret
- Eğer hiç anlaşmazlık yoksa, resolvedDisagreements ve unresolvedDisagreements boş dizi olsun
- Eğer pozisyon değişikliği yoksa, positionChanges boş dizi olsun
- Hiç edit önerisi yoksa, arbitratedEdits boş dizi olsun
- sourceProposals SADECE yukarıdaki listede [ID] olarak gösterilen gerçek proposal ID'lerini içersin
- clauseRef ajan proposal'larındakilerle birebir aynı olsun (eşleşme kaybını önlemek için)
- finalSeverity genellikle source proposal severity'sini korur; escalation ancak rebuttal/cross-clause etkiyle gerekçeli olur, proaktif düşürme yasak. info severity'li edit'ler (yazım/gramer/tipografi) aynen yansıtılmalı
- Türkçe yanıt ver
- Sadece JSON döndür`;
}

// --- Normalizer ---

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

const VALID_RISK = new Set(["high", "medium", "low"]);

function normalizeResolved(raw: unknown): ResolvedDisagreement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => isString(d?.topic))
    .map((d) => ({
      topic: String(d.topic).slice(0, 100),
      agentA: isString(d.agentA) ? d.agentA : "Ajan A",
      agentB: isString(d.agentB) ? d.agentB : "Ajan B",
      resolution: isString(d.resolution) ? String(d.resolution).slice(0, 200) : "Kurul sentezi ile çözüldü.",
    }));
}

function normalizeUnresolved(raw: unknown): UnresolvedDisagreement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => isString(d?.topic))
    .map((d) => ({
      topic: String(d.topic).slice(0, 100),
      agentA: isString(d.agentA) ? d.agentA : "Ajan A",
      agentB: isString(d.agentB) ? d.agentB : "Ajan B",
      reason: isString(d.reason) ? String(d.reason).slice(0, 200) : "Taraflar uzlaşamadı.",
    }));
}

function normalizePositionChanges(raw: unknown): PositionChange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => isString(p?.agentId) && isString(p?.topic))
    .map((p) => ({
      agentId: p.agentId,
      agentName: isString(p.agentName) ? p.agentName : p.agentId,
      topic: String(p.topic).slice(0, 100),
      previousStance: isString(p.previousStance) ? String(p.previousStance).slice(0, 200) : "",
      updatedStance: isString(p.updatedStance) ? String(p.updatedStance).slice(0, 200) : "",
    }));
}

export function normalizeChiefPassResult(
  raw: Record<string, unknown>,
  agentResults: AgentPassResult[],
): ChiefPassResult {
  const perspectives: ChiefPassPerspective[] = [];

  if (Array.isArray(raw.agentPerspectives)) {
    for (const p of raw.agentPerspectives) {
      if (isString(p?.agentId)) {
        perspectives.push({
          agentId: p.agentId,
          agentName: isString(p.agentName) ? p.agentName : p.agentId,
          avatar: isString(p.avatar) ? p.avatar : "👤",
          position: String(p.position ?? "Değerlendirmesini tamamladı.").slice(0, 300),
        });
      }
    }
  }

  // Fill missing perspectives from agent results
  for (const ar of agentResults) {
    if (!perspectives.find((p) => p.agentId === ar.agentId)) {
      perspectives.push({
        agentId: ar.agentId,
        agentName: ar.agentName,
        avatar: ar.avatar,
        position: ar.overallPosition,
      });
    }
  }

  const decisions = Array.isArray(raw.decisions)
    ? raw.decisions.filter(isString).map((d) => String(d).slice(0, 200))
    : [];

  const actionItems = Array.isArray(raw.actionItems)
    ? raw.actionItems.filter(isString).map((a) => String(a).slice(0, 200))
    : [];

  return {
    synthesis: isString(raw.synthesis) ? String(raw.synthesis).slice(0, 500) : "Kurul görüşleri sentezlendi.",
    summary: isString(raw.summary) ? String(raw.summary).slice(0, 500) : "Kurul değerlendirmesi tamamlandı.",
    riskLevel: VALID_RISK.has(raw.riskLevel as string) ? (raw.riskLevel as "high" | "medium" | "low") : "medium",
    confidenceLevel: VALID_RISK.has(raw.confidenceLevel as string) ? (raw.confidenceLevel as ConfidenceLevel) : "medium",
    decisions: decisions.length > 0 ? decisions : ["Belge değerlendirmesi tamamlandı."],
    actionItems: actionItems.length > 0 ? actionItems : ["1. Detaylı inceleme yapılmalı."],
    agentPerspectives: perspectives,
    resolvedDisagreements: normalizeResolved(raw.resolvedDisagreements),
    unresolvedDisagreements: normalizeUnresolved(raw.unresolvedDisagreements),
    positionChanges: normalizePositionChanges(raw.positionChanges),
    arbitratedEdits: normalizeArbitratedEdits(raw.arbitratedEdits, agentResults),
  };
}

// --- Arbitrated edit normalizer (Faz 4) ---

const VALID_EDIT_TYPES: EditType[] = [
  "replace_clause",
  "replace_phrase",
  "insert_after",
  "delete_clause",
];

const VALID_RESOLUTIONS: ArbitrationResolution[] = [
  "accepted_a",
  "accepted_b",
  "merged",
  "rewritten",
  "rejected_all",
  "orphan_unmatched",
];

const VALID_SEVERITY: EditSeverity[] = ["critical", "warning", "info"];

function normalizeArbitratedEdits(
  raw: unknown,
  agentResults: AgentPassResult[],
): ArbitratedEdit[] {
  if (!Array.isArray(raw)) return [];

  // Build proposal ID set so sourceProposals can be validated against
  // the ground truth. Chief can't invent IDs.
  const knownProposalIds = new Set<string>();
  for (const ar of agentResults) {
    for (const p of ar.editProposals) knownProposalIds.add(p.id);
  }

  const out: ArbitratedEdit[] = [];
  let idx = 0;
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const obj = e as Record<string, unknown>;

    const clauseRef = isString(obj.clauseRef)
      ? String(obj.clauseRef).slice(0, 200).trim()
      : null;
    const editTypeRaw = isString(obj.editType) ? obj.editType : null;
    const finalText = isString(obj.finalText)
      ? String(obj.finalText).slice(0, 5000)
      : null;
    const resolutionRaw = isString(obj.resolution) ? obj.resolution : null;

    if (!clauseRef || !editTypeRaw || finalText === null) continue;
    if (!VALID_EDIT_TYPES.includes(editTypeRaw as EditType)) continue;

    const editType = editTypeRaw as EditType;

    if (editType !== "delete_clause" && finalText.length === 0 && resolutionRaw !== "rejected_all") {
      continue;
    }

    const resolution: ArbitrationResolution = VALID_RESOLUTIONS.includes(
      resolutionRaw as ArbitrationResolution,
    )
      ? (resolutionRaw as ArbitrationResolution)
      : "rewritten";

    // sourceProposals: keep only IDs that really exist.
    const sourceProposals: string[] = Array.isArray(obj.sourceProposals)
      ? (obj.sourceProposals as unknown[])
          .filter((id): id is string => typeof id === "string")
          .filter((id) => knownProposalIds.has(id))
      : [];

    const finalSeverity: EditSeverity = VALID_SEVERITY.includes(
      obj.finalSeverity as EditSeverity,
    )
      ? (obj.finalSeverity as EditSeverity)
      : "info";

    const originalText = isString(obj.originalText)
      ? String(obj.originalText).slice(0, 2000)
      : undefined;

    out.push({
      id: `arb-${idx++}`,
      clauseRef,
      editType,
      originalText,
      finalText,
      sourceProposals,
      arbitrationNote: isString(obj.arbitrationNote)
        ? String(obj.arbitrationNote).slice(0, 500)
        : "",
      resolution,
      finalSeverity,
    });
  }
  return out;
}
