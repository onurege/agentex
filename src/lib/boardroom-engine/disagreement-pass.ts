// ============================================================
// Disagreement Pass — Cross-agent tension detection
// ============================================================
//
// Takes all agent observation results and identifies genuine
// disagreements or tensions between agents.
// ============================================================

import type { AgentPassResult } from "./agent-pass";

// --- Output ---

export interface DisagreementPassEntry {
  topic: string;
  agentAId: string;
  agentAName: string;
  agentAPosition: string;
  agentBId: string;
  agentBName: string;
  agentBPosition: string;
  severity: "minor" | "significant" | "critical";
}

export interface DisagreementPassResult {
  disagreements: DisagreementPassEntry[];
  consensusPoints: string[];
}

// --- Prompt builder ---

export function buildDisagreementPassPrompt(
  agentResults: AgentPassResult[],
  documentFileName: string,
): string {
  const agentSummaries = agentResults.map((ar) => {
    const obsText = ar.observations.map((o) => `  - [${o.severity}] ${o.topic}: ${o.message}`).join("\n");
    return `### ${ar.agentName} (${ar.agentId})
Gözlemler:
${obsText}
Ana endişe: ${ar.keyConcern}
Genel pozisyon: ${ar.overallPosition}`;
  }).join("\n\n");

  return `Sen bir AI Boardroom analist ajanısın. Aşağıdaki uzman ajanlar "${documentFileName}" belgesini bağımsız olarak değerlendirdi.

## AJAN DEĞERLENDİRMELERİ

${agentSummaries}

## GÖREV

Bu ajanların görüşlerini karşılaştır. Gerçek görüş ayrılıkları ve uzlaşı noktalarını tespit et. Aşağıdaki JSON yapısında yanıt ver:

{
  "disagreements": [
    {
      "topic": "Anlaşmazlık konusu",
      "agentAId": "ajan-id-1",
      "agentAName": "Ajan 1 Kısa İsim",
      "agentAPosition": "Ajan 1'in pozisyonu (1-2 cümle)",
      "agentBId": "ajan-id-2",
      "agentBName": "Ajan 2 Kısa İsim",
      "agentBPosition": "Ajan 2'nin pozisyonu (1-2 cümle)",
      "severity": "minor | significant | critical"
    }
  ],
  "consensusPoints": ["Tüm ajanların uzlaştığı nokta 1", "Uzlaşı noktası 2"]
}

KURALLAR:
- Sadece gerçek, somut görüş ayrılıkları belirt
- Yapay çatışma üretme
- Eğer gerçek bir anlaşmazlık yoksa boş dizi döndür
- Her anlaşmazlık farklı bir konu hakkında olsun
- Uzlaşı noktalarını da belirt
- Türkçe yanıt ver
- Sadece JSON döndür`;
}

// --- Normalizer ---

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export function normalizeDisagreementPassResult(
  raw: Record<string, unknown>,
): DisagreementPassResult {
  const disagreements: DisagreementPassEntry[] = [];

  if (Array.isArray(raw.disagreements)) {
    for (const d of raw.disagreements) {
      if (isString(d?.topic) && isString(d?.agentAId) && isString(d?.agentBId)) {
        disagreements.push({
          topic: String(d.topic).slice(0, 100),
          agentAId: d.agentAId,
          agentAName: isString(d.agentAName) ? d.agentAName : d.agentAId,
          agentAPosition: String(d.agentAPosition ?? "").slice(0, 200),
          agentBId: d.agentBId,
          agentBName: isString(d.agentBName) ? d.agentBName : d.agentBId,
          agentBPosition: String(d.agentBPosition ?? "").slice(0, 200),
          severity: ["minor", "significant", "critical"].includes(d.severity) ? d.severity : "minor",
        });
      }
    }
  }

  const consensusPoints: string[] = [];
  if (Array.isArray(raw.consensusPoints)) {
    for (const p of raw.consensusPoints) {
      if (isString(p)) consensusPoints.push(String(p).slice(0, 200));
    }
  }

  return { disagreements, consensusPoints };
}
