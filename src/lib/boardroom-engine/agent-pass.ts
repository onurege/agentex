// ============================================================
// Agent Pass — Per-agent observation generation
// ============================================================
//
// Each agent independently reads the document through its own
// published identity + published prompt and produces structured
// observations. This is NOT a single model inventing everything.
// ============================================================

import type { BoardroomAnalysisInput } from "./types";
import type { EditProposal, EditType, EditSeverity } from "../redline/types";

// --- Per-agent output ---

export interface AgentPassObservation {
  message: string;
  topic: string;
  sectionRef?: string;
  severity: "info" | "warning" | "critical";
}

export interface AgentPassResult {
  agentId: string;
  agentName: string;
  avatar: string;
  observations: AgentPassObservation[];
  keyConcern: string;
  suggestedAction: string;
  overallPosition: string;
  /**
   * Faz 4: clause-level edit suggestions. Consumed by the chief
   * arbitration pass and, post-arbitration, by the redline renderer.
   */
  editProposals: EditProposal[];
}

// --- Prompt builder ---

export function buildAgentPassPrompt(
  agent: BoardroomAnalysisInput["agents"][number],
  document: BoardroomAnalysisInput["document"],
  contextNotes: string,
): string {
  const docContent = document.sections.length > 0
    ? document.sections.map((s) => {
        const ref = s.clauseRef ? `[${s.clauseRef}] ` : "";
        return `${ref}${s.title}\n${s.content.slice(0, 600)}`;
      }).join("\n\n---\n\n")
    : document.fullText?.slice(0, 4000) ?? "Belge içeriği mevcut değil.";

  const agentConfig = [
    `İsim: ${agent.name}`,
    `Unvan: ${agent.title}`,
    `Uzmanlık: ${agent.expertise.join(", ")}`,
    `Ton: ${agent.tone}`,
    `Risk Odağı: ${agent.riskFocus}`,
    `Düşünme Tarzı: ${agent.thinkingStyle}`,
  ];
  if (agent.systemPrompt) agentConfig.push(`\nSistem Talimatı: ${agent.systemPrompt}`);
  if (agent.rolePrompt) agentConfig.push(`Rol Talimatı: ${agent.rolePrompt}`);
  if (agent.outputRules) agentConfig.push(`Çıktı Kuralları: ${agent.outputRules}`);
  if (agent.guardrails) agentConfig.push(`Sınırlamalar: ${agent.guardrails}`);

  return `Sen ${agent.name} rolünde bir uzman AI ajanısın. Aşağıdaki belgeyi kendi uzmanlık alanından değerlendir.

## SENİN PROFİLİN

${agentConfig.join("\n")}

## BELGE

Dosya: ${document.fileName}

${docContent}

${contextNotes ? `## BAĞLAM NOTU\n${contextNotes}` : ""}

## GÖREV

Bu belgeyi YALNIZCA kendi uzmanlık alanın perspektifinden değerlendir. İki tür çıktı üret:
1. **observations** — genel görüşler ve riskler (verdict ekranı için)
2. **editProposals** — clause-level somut metin düzeltmeleri (redline çıktısı için)

## SEVERITY KATEGORİLERİ (editProposals için zorunlu dağılım)

editProposals'da üç kategorinin HEPSİ taranmalı. Uzmanlık alanına göre
ağırlık değişebilir ama sadece critical üretmek kabul edilmez:

- **info** — Yazım hatası, gramer, noktalama, terim tutarlılığı (örn.
  "BAYİ" ↔ "Bayi" case tutarsızlığı), eksik/yanlış kısaltma, İngilizce-
  Türkçe karışımı, tarih/birim formatı çelişkisi. Belgeyi bir editör
  gibi oku; görünür defect varsa EN AZ 1 info önerisi üret. Defect
  yoksa uydurma — zorla çıkarma.

- **warning** — Belirsiz ifade, eksik tanım, zayıf formülasyon,
  sözleşme netliğini azaltan dil, yoruma açık taahhüt.

- **critical** — Hukuki/mali risk, çelişki, eksik hüküm, yanlış
  referans, yaptırımı belirsiz taahhüt, uyumluluk ihlali.

Aşağıdaki JSON yapısında yanıt ver:

{
  "observations": [
    {
      "message": "Kısa gözlem (1-2 cümle)",
      "topic": "İlgili bölüm veya konu adı",
      "sectionRef": "Varsa madde/bölüm referansı (opsiyonel)",
      "severity": "info | warning | critical"
    }
  ],
  "editProposals": [
    {
      "clauseRef": "Belgedeki başlığı AYNEN kopyala (ör. 'Madde 4.2', '4.1', '4. BAYİ YETKİ DERECELERİ', 'Article 3', 'Gizlilik Yükümlülüğü'). Belge hangi formatı kullanıyorsa onu kullan — format dayatma. ZORUNLU: serbest açıklama veya parafraz yasak, başlık literal olacak.",
      "editType": "replace_clause | replace_phrase | insert_after | delete_clause",
      "originalText": "replace_phrase için ZORUNLU — değiştirilecek metnin birebir kopyası. Diğer tipler için boş/atla.",
      "proposedText": "Yeni metin. delete_clause için boş.",
      "rationale": "Neden bu değişiklik gerekli (1-2 cümle)",
      "severity": "info | warning | critical"
    },
    {
      "clauseRef": "2. SÖZLEŞME KONUSU",
      "editType": "replace_phrase",
      "originalText": "sözleşe",
      "proposedText": "sözleşme",
      "rationale": "Yazım hatası: 'sözleşe' → 'sözleşme'.",
      "severity": "info"
    }
  ],
  "keyConcern": "En önemli endişen (1 cümle)",
  "suggestedAction": "Önerdiğin aksiyon (1 cümle)",
  "overallPosition": "Genel değerlendirmen (1-2 cümle)"
}

KURALLAR:
- En az 2, en fazla 4 gözlem üret
- Uzmanlık alanınla ilgili 0-5 edit proposal üret (zorunlu bir alan değilse boş bırak)
- Üç severity kategorisi de taranmalı (info/warning/critical); belgede görünür yazım/gramer/tutarlılık defect'i varsa en az 1 info önerisi zorunlu — yoksa üretme
- Her edit proposal kendi uzmanlık alanından olsun (info kategorisi tüm ajanlar için ortak; proofreading görevini üstlen)
- clauseRef'i belgedeki başlığın birebir kopyası olarak yaz — numaralandırma formatı neyse onu koru, "Madde" kelimesini belge kullanmıyorsa ekleme
- replace_phrase kullanıyorsan originalText belgedeki ibarenin birebir kopyası olmalı
- Mesajlar kısa ve vurucu olsun
- Türkçe yanıt ver
- Sadece JSON döndür`;
}

// --- Normalizer ---

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

const VALID_EDIT_TYPES: EditType[] = [
  "replace_clause",
  "replace_phrase",
  "insert_after",
  "delete_clause",
];

const VALID_SEVERITY: EditSeverity[] = ["critical", "warning", "info"];

function normalizeEditProposals(
  raw: unknown,
  agentId: string,
): EditProposal[] {
  if (!Array.isArray(raw)) return [];
  const out: EditProposal[] = [];
  let idx = 0;
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const obj = p as Record<string, unknown>;

    const clauseRef = isString(obj.clauseRef)
      ? String(obj.clauseRef).slice(0, 200).trim()
      : null;
    const editTypeRaw = isString(obj.editType) ? obj.editType : null;
    const proposedText = isString(obj.proposedText)
      ? String(obj.proposedText).slice(0, 5000)
      : null;

    if (!clauseRef || !editTypeRaw) continue;
    if (!VALID_EDIT_TYPES.includes(editTypeRaw as EditType)) continue;

    const editType = editTypeRaw as EditType;

    // delete_clause permits empty proposedText; everything else requires text.
    if (editType !== "delete_clause" && (proposedText === null || proposedText.length === 0)) {
      continue;
    }

    // replace_phrase requires originalText to locate the span.
    const originalText = isString(obj.originalText)
      ? String(obj.originalText).slice(0, 2000)
      : undefined;
    if (editType === "replace_phrase" && !originalText) continue;

    const rationale = isString(obj.rationale)
      ? String(obj.rationale).slice(0, 500)
      : "";

    const severity: EditSeverity = VALID_SEVERITY.includes(
      obj.severity as EditSeverity,
    )
      ? (obj.severity as EditSeverity)
      : "info";

    out.push({
      id: `prop-${agentId}-${idx++}`,
      agentId,
      clauseRef,
      editType,
      originalText,
      proposedText: proposedText ?? "",
      rationale,
      severity,
    });
  }
  return out;
}

export function normalizeAgentPassResult(
  raw: Record<string, unknown>,
  agent: BoardroomAnalysisInput["agents"][number],
): AgentPassResult {
  const observations: AgentPassObservation[] = [];

  if (Array.isArray(raw.observations)) {
    for (const o of raw.observations) {
      if (isString(o?.message)) {
        observations.push({
          message: String(o.message).slice(0, 300),
          topic: String(o.topic ?? "Genel").slice(0, 100),
          sectionRef: isString(o.sectionRef) ? String(o.sectionRef).slice(0, 50) : undefined,
          severity: ["info", "warning", "critical"].includes(o.severity) ? o.severity : "info",
        });
      }
    }
  }

  return {
    agentId: agent.id,
    agentName: agent.shortName,
    avatar: agent.avatar,
    observations: observations.length > 0 ? observations : [
      { message: "Belge değerlendirildi.", topic: "Genel", severity: "info" as const },
    ],
    keyConcern: isString(raw.keyConcern) ? String(raw.keyConcern).slice(0, 200) : "Belirgin bir endişe tespit edilmedi.",
    suggestedAction: isString(raw.suggestedAction) ? String(raw.suggestedAction).slice(0, 200) : "Detaylı inceleme önerilir.",
    overallPosition: isString(raw.overallPosition) ? String(raw.overallPosition).slice(0, 300) : `${agent.shortName} değerlendirmesini tamamladı.`,
    editProposals: normalizeEditProposals(raw.editProposals, agent.id),
  };
}
