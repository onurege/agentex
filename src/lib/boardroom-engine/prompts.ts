// ============================================================
// Boardroom Prompt Builder
// ============================================================
//
// Builds Gemini prompts for AI boardroom analysis using
// published agent CV + prompt data.
// ============================================================

import type { BoardroomAnalysisInput } from "./types";

/**
 * Build the representation directive that steers every agent + the chief.
 * Injected near the top of every prompt that runs in this pipeline.
 *
 * The user picks both fields explicitly in the setup screen — there is no
 * default. Empty input here means a programming error; we still emit a
 * directive so the model never sees a missing block.
 */
export function buildStanceDirective(
  clientParty: string,
  stance: BoardroomAnalysisInput["stance"],
): string {
  const partyLabel = clientParty.trim().length > 0
    ? clientParty.trim()
    : "(taraf belirtilmemiş)";

  const stanceInstruction: Record<BoardroomAnalysisInput["stance"], string> = {
    aggressive: `TUTUM — SERT SAVUNMA: Kullanıcı "${partyLabel}" tarafını temsil ediyor. Bu tarafın çıkarını maksimum koruyacak biçimde değerlendir. Karşı tarafın istismar edici, belirsiz veya tek taraflı maddelerini AGRESİF biçimde işaretle ve sert düzeltme öner. Taviz minimum, koruma maksimum. Karşı taraf lehine yorum yapma.`,
    favor: `TUTUM — LEHİME · DENGELİ: Kullanıcı "${partyLabel}" tarafını temsil ediyor. Bu tarafın lehinde değerlendirme yap, ancak ilişkiyi koruyacak makul taviz noktalarını da göster. Sert dilden kaçın; "tarafımızca kabul edilebilir / kabul edilemez" çerçevesinde net duruş al. Karşı tarafın haklı olduğu noktaları kabul edebilirsin ama kullanıcı menfaatini öncelikli tut.`,
    objective: `TUTUM — OBJEKTİF: Kullanıcı tarafsız değerlendirme istiyor. Hiçbir tarafa meyletme. Belgeyi her iki taraf için de adil ve dengeli analiz et. Riskleri, belirsizlikleri ve avantajları her iki taraf perspektifinden de göster. Kullanıcının "${partyLabel}" tarafında olduğunu BİL ama yorumun bu tarafa kayma yapmasın.`,
    winwin: `TUTUM — UZLAŞMACI / WIN-WIN: Kullanıcı "${partyLabel}" tarafını temsil ediyor ama uzlaşmacı bir yaklaşım istiyor. Karşı tarafın haklı kaygılarını da gör; ortak değer yaratan, uzun vadeli ilişkiyi koruyan dengeli formülasyonlar öner. Yıkıcı dil yerine müzakereye uygun çözümler üret. Her iki tarafın da kabul edebileceği orta yol vurgusu yap.`,
  };

  return `## TEMSİL VE TUTUM (KRİTİK — TÜM ÇIKTIYI YÖNLENDİR)\n${stanceInstruction[stance]}`;
}

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
