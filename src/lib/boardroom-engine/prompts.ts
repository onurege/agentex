// ============================================================
// Boardroom Prompt Builder
// ============================================================
//
// Builds Gemini prompts for AI boardroom analysis using
// published agent CV + prompt data.
// ============================================================

import type { BoardroomAnalysisInput } from "./types";

export function buildBoardroomAnalysisPrompt(input: BoardroomAnalysisInput): string {
  const agentDescriptions = input.agents.map((agent) => {
    const lines = [
      `### ${agent.name} (${agent.shortName})`,
      `Unvan: ${agent.title}`,
      `Uzmanlık: ${agent.expertise.join(", ")}`,
      `Ton: ${agent.tone}`,
      `Risk Odağı: ${agent.riskFocus}`,
      `Düşünme Tarzı: ${agent.thinkingStyle}`,
    ];
    if (agent.systemPrompt) lines.push(`Sistem Talimatı: ${agent.systemPrompt}`);
    if (agent.rolePrompt) lines.push(`Rol Talimatı: ${agent.rolePrompt}`);
    if (agent.outputRules) lines.push(`Çıktı Kuralları: ${agent.outputRules}`);
    if (agent.guardrails) lines.push(`Sınırlamalar: ${agent.guardrails}`);
    return lines.join("\n");
  }).join("\n\n");

  const documentContent = input.document.sections.length > 0
    ? input.document.sections.map((s) => {
        const ref = s.clauseRef ? `[${s.clauseRef}] ` : "";
        return `${ref}${s.title}\n${s.content.slice(0, 500)}`;
      }).join("\n\n---\n\n")
    : input.document.fullText?.slice(0, 3000) ?? "Belge içeriği mevcut değil.";

  return `Sen bir AI Boardroom kurul koordinatörüsün. Aşağıdaki uzman ajanlar bir belgeyi değerlendiriyor.

## AJANLAR

${agentDescriptions}

## BELGE

Dosya: ${input.document.fileName}

${documentContent}

${input.contextNotes ? `## BAĞLAM NOTU\n${input.contextNotes}` : ""}

## GÖREV

Her ajanın uzmanlık alanına ve yapılandırmasına göre belgeyi analiz et ve aşağıdaki JSON yapısında yanıt ver:

{
  "observations": [
    { "agentId": "agent-id", "agentName": "Kısa İsim", "message": "Kısa gözlem cümlesi", "topic": "İlgili bölüm/konu" }
  ],
  "objections": [
    { "agentId": "agent-id", "agentName": "Kısa İsim", "message": "Kısa itiraz cümlesi", "topic": "İlgili bölüm/konu" }
  ],
  "disagreements": [
    { "topic": "Konu", "agentAId": "id", "agentAName": "İsim", "agentAPosition": "Pozisyon", "agentBId": "id", "agentBName": "İsim", "agentBPosition": "Karşı pozisyon" }
  ],
  "chiefSynthesis": "Kurul sentez cümlesi",
  "verdict": {
    "summary": "2-3 cümlelik değerlendirme özeti",
    "riskLevel": "high" | "medium" | "low",
    "decisions": ["Karar 1", "Karar 2"],
    "actionItems": ["1. Aksiyon maddesi", "2. Aksiyon maddesi"],
    "agentPerspectives": [
      { "agentId": "id", "agentName": "İsim", "avatar": "emoji", "position": "Son pozisyon" }
    ]
  }
}

KURALLAR:
- Her ajan için en az 1 gözlem üret
- En az 1 itiraz üret (en ilgili ajan için)
- Eğer mantıklıysa 1 görüş ayrılığı üret
- Her ajan kendi uzmanlık alanı perspektifinden konuşsun
- Mesajlar kısa ve vurucu olsun (1-2 cümle)
- Konular belge bölümlerine referans versin
- Risk seviyesi belgenin genel riskine göre belirlensin
- Türkçe yanıt ver
- Sadece JSON döndür, başka metin ekleme`;
}
