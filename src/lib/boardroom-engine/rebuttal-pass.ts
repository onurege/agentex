// ============================================================
// Rebuttal Pass — Per-agent response round
// ============================================================
//
// Each involved agent independently responds to the opposing
// position in its own AI call, using its own published identity
// and prompt config. This produces authentic agent voices.
//
// Bounded: max 1 rebuttal per agent per disagreement topic.
// ============================================================

import type { AgentPassResult } from "./agent-pass";
import type { DisagreementPassEntry } from "./disagreement-pass";
import type { BoardroomAnalysisInput } from "./types";

// --- Output ---

export type RebuttalStance = "defend" | "challenge" | "concede" | "refine";

export interface RebuttalEntry {
  speakingAgentId: string;
  speakingAgentName: string;
  targetAgentId: string;
  targetAgentName: string;
  topic: string;
  message: string;
  stance: RebuttalStance;
  sectionRef?: string;
}

export interface RebuttalPassResult {
  rebuttals: RebuttalEntry[];
}

// --- Per-agent rebuttal prompt ---

export function buildPerAgentRebuttalPrompt(
  agent: BoardroomAnalysisInput["agents"][number],
  agentResult: AgentPassResult,
  relevantDisagreements: DisagreementPassEntry[],
): string {
  const disagText = relevantDisagreements.map((d, i) => {
    const isAgentA = d.agentAId === agent.id;
    const opponentName = isAgentA ? d.agentBName : d.agentAName;
    const opponentPosition = isAgentA ? d.agentBPosition : d.agentAPosition;
    const myPosition = isAgentA ? d.agentAPosition : d.agentBPosition;
    return `### Konu ${i + 1}: ${d.topic}
Senin pozisyonun: ${myPosition}
${opponentName}'in pozisyonu: ${opponentPosition}
Ciddiyet: ${d.severity}`;
  }).join("\n\n");

  const agentConfig = [
    `İsim: ${agent.name} (${agent.shortName})`,
    `Unvan: ${agent.title}`,
    `Uzmanlık: ${agent.expertise.join(", ")}`,
    `Ton: ${agent.tone}`,
    `Risk Odağı: ${agent.riskFocus}`,
    `Düşünme Tarzı: ${agent.thinkingStyle}`,
  ];
  if (agent.systemPrompt) agentConfig.push(`Sistem Talimatı: ${agent.systemPrompt}`);
  if (agent.rolePrompt) agentConfig.push(`Rol Talimatı: ${agent.rolePrompt}`);
  if (agent.guardrails) agentConfig.push(`Sınırlamalar: ${agent.guardrails}`);

  return `Sen ${agent.name} rolünde bir uzman AI ajanısın. Kurul tartışmasında karşı tarafın pozisyonuna yanıt vermen gerekiyor.

## SENİN PROFİLİN

${agentConfig.join("\n")}

Önceki genel pozisyonun: ${agentResult.overallPosition}
Ana endişen: ${agentResult.keyConcern}

## KARŞI POZİSYONLAR

${disagText}

## GÖREV

Her anlaşmazlık konusu için karşı pozisyona kendi uzmanlık alanın perspektifinden yanıt ver.

Aşağıdaki JSON yapısında yanıt ver:

{
  "rebuttals": [
    {
      "targetAgentName": "Karşı tarafın kısa ismi",
      "topic": "Anlaşmazlık konusu",
      "message": "Yanıtın (1-2 cümle, kendi tonunla)",
      "stance": "defend | challenge | concede | refine",
      "sectionRef": "Varsa belge referansı (opsiyonel)"
    }
  ]
}

STANCE AÇIKLAMALARI:
- defend: Kendi pozisyonunu savunuyorsun, karşı tarafı ikna etmeye çalışıyorsun
- challenge: Karşı pozisyonu doğrudan sorguluyorsun
- concede: Karşı tarafın haklı olduğunu kısmen kabul ediyorsun
- refine: Karşı tarafın görüşünü dikkate alarak pozisyonunu güncelliyorsun

KURALLAR:
- Her konu için tam 1 yanıt üret
- Yanıtın kendi uzmanlık alanın ve tonun çerçevesinde olsun
- Kısa ve vurucu ol (1-2 cümle)
- Dürüst ol — eğer karşı taraf haklıysa "concede" veya "refine" kullan
- Türkçe yanıt ver
- Sadece JSON döndür`;
}

// --- Normalizer ---

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

const VALID_STANCES = new Set<RebuttalStance>(["defend", "challenge", "concede", "refine"]);

export function normalizePerAgentRebuttalResult(
  raw: Record<string, unknown>,
  agent: BoardroomAnalysisInput["agents"][number],
  relevantDisagreements: DisagreementPassEntry[],
): RebuttalEntry[] {
  const rebuttals: RebuttalEntry[] = [];

  if (Array.isArray(raw.rebuttals)) {
    for (const r of raw.rebuttals) {
      if (isString(r?.message) && isString(r?.topic)) {
        // Find the disagreement to get targetAgentId
        const disagMatch = relevantDisagreements.find((d) => d.topic === r.topic);
        const targetId = disagMatch
          ? (disagMatch.agentAId === agent.id ? disagMatch.agentBId : disagMatch.agentAId)
          : "unknown";
        const targetName = isString(r.targetAgentName) ? r.targetAgentName
          : disagMatch
            ? (disagMatch.agentAId === agent.id ? disagMatch.agentBName : disagMatch.agentAName)
            : "Ajan";

        rebuttals.push({
          speakingAgentId: agent.id,
          speakingAgentName: agent.shortName,
          targetAgentId: targetId,
          targetAgentName: targetName,
          topic: String(r.topic).slice(0, 100),
          message: String(r.message).slice(0, 300),
          stance: VALID_STANCES.has(r.stance) ? r.stance : "defend",
          sectionRef: isString(r.sectionRef) ? String(r.sectionRef).slice(0, 50) : undefined,
        });
      }
    }
  }

  return rebuttals;
}

// --- Legacy compat: still export the grouped normalizer for older code paths ---

export function normalizeRebuttalPassResult(
  raw: Record<string, unknown>,
): RebuttalPassResult {
  const rebuttals: RebuttalEntry[] = [];
  if (Array.isArray(raw.rebuttals)) {
    for (const r of raw.rebuttals) {
      if (isString(r?.speakingAgentId) && isString(r?.message) && isString(r?.topic)) {
        rebuttals.push({
          speakingAgentId: r.speakingAgentId,
          speakingAgentName: isString(r.speakingAgentName) ? r.speakingAgentName : r.speakingAgentId,
          targetAgentId: isString(r.targetAgentId) ? r.targetAgentId : "unknown",
          targetAgentName: isString(r.targetAgentName) ? r.targetAgentName : "Ajan",
          topic: String(r.topic).slice(0, 100),
          message: String(r.message).slice(0, 300),
          stance: VALID_STANCES.has(r.stance) ? r.stance : "defend",
          sectionRef: isString(r.sectionRef) ? String(r.sectionRef).slice(0, 50) : undefined,
        });
      }
    }
  }
  return { rebuttals };
}
