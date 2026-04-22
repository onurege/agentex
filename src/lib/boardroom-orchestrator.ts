// ============================================================
// Boardroom Debate Orchestrator
// ============================================================
//
// Generates a deterministic, data-driven debate sequence from:
//   - selected agents (with published CV + prompt via StageAgent)
//   - parsed document sections
//   - context notes
//   - prompt-derived debate style (tone, assertiveness, guardrails)
//
// Produces timed DebateEvents that drive the boardroom scene.
// Future: replace with real AI-generated debate.
// ============================================================

import type { ParsedDocument, DocumentSection } from "./ingestion/types";
import type { StageAgent } from "./stage-agents";
import { getStageAgentSnapshot } from "./stage-agents";
import {
  CHIEF_AGENT,
  type DebateEvent,
  type DebateEventType,
  type VerdictSeed,
  type BoardroomPhase,
  type AgentSceneState,
} from "./boardroom-flow-store";
import {
  buildDebateStyle,
  applyPromptStyleToMessage,
  buildVerdictStyleModifier,
  type DebateStyle,
} from "./prompt-behavior";
import type { BoardroomAnalysisResult } from "./boardroom-engine/types";

// --- Orchestration step ---

export interface OrchestrationStep {
  delayMs: number;
  phase: BoardroomPhase;
  agentId: string;
  agentSceneStatus: AgentSceneState["status"];
  event: Omit<DebateEvent, "id" | "timestamp">;
  topic: string;
}

// --- Topic extraction ---

function extractTopics(doc: ParsedDocument | null, _contextNotes: string): string[] {
  const topics: string[] = [];

  if (doc) {
    const sections = doc.sections.filter(
      (s: DocumentSection) => s.title && s.sectionType !== "context" && s.title !== "Genel Bakış",
    );
    for (const section of sections.slice(0, 6)) {
      const label = section.clauseRef
        ? `${section.clauseRef} — ${section.title}`
        : section.title;
      topics.push(label);
    }
  }

  if (topics.length === 0) {
    topics.push(
      "Genel Yapı ve Kapsam",
      "Yükümlülükler",
      "Risk Dağılımı",
      "Mali Koşullar",
    );
  }

  return topics;
}

// --- Base speech templates ---

interface SpeechTemplate {
  observations: string[];
  objections: string[];
  defenses: string[];
}

const BASE_SPEECH_TEMPLATES: Record<string, SpeechTemplate> = {
  "legal-counsel": {
    observations: [
      "Bu bölümdeki sorumluluk dağılımı açık değil.",
      "Fesih koşulları tarafımız aleyhine ağırlıklı.",
      "Tazminat üst sınırı belirtilmemiş, bu ciddi risk.",
    ],
    objections: [
      "Bu madde hukuki açıdan kabul edilemez.",
      "Sorumluluk sınırı olmadan ilerlemek riskli.",
    ],
    defenses: [
      "Hukuki koruma açısından bu madde yeterli.",
      "Standart sektör uygulamasıyla tutarlı.",
    ],
  },
  "finance-director": {
    observations: [
      "Ödeme koşulları nakit akışını olumsuz etkileyebilir.",
      "Maliyet yapısı net tanımlanmamış.",
      "Fiyat artışı mekanizması tarafımız aleyhine.",
    ],
    objections: [
      "Bu maliyet yapısı mali açıdan sürdürülemez.",
      "Ödeme vadesi çok uzun, mali riski artırıyor.",
    ],
    defenses: [
      "Mali koşullar makul seviyede.",
      "Bütçe etkisi yönetilebilir düzeyde.",
    ],
  },
  "tax-advisor": {
    observations: [
      "Stopaj yükümlülükleri netleştirilmeli.",
      "KDV uygulaması belirsiz bırakılmış.",
      "Transfer fiyatlandırması riskleri mevcut.",
    ],
    objections: [
      "Vergisel yükümlülükler eksik tanımlanmış.",
      "Bu yapı vergi otoritesince sorunlu görülebilir.",
    ],
    defenses: [
      "Vergisel yapı mevzuata uygun.",
      "Stopaj gereksinimleri karşılanmış.",
    ],
  },
  "sales-director": {
    observations: [
      "Münhasırlık maddesi ticari esnekliği kısıtlıyor.",
      "Rekabet yasağı kapsamı geniş tutulmuş.",
      "Komisyon yapısı anlaşma değerini düşürüyor.",
    ],
    objections: [
      "Bu koşullar ticari olarak uygulanabilir değil.",
      "Anlaşma değeri pazar koşullarının altında.",
    ],
    defenses: [
      "Ticari koşullar rekabetçi düzeyde.",
      "Anlaşma yapısı hedeflerimizle uyumlu.",
    ],
  },
  "product-director": {
    observations: [
      "SLA taahhütleri mevcut kapasitemizin üzerinde.",
      "Entegrasyon kapsamı net tanımlanmamış.",
      "Operasyonel yük hesaplanandan fazla olabilir.",
    ],
    objections: [
      "Bu teknik taahhütleri karşılamak mümkün değil.",
      "Operasyonel yük sürdürülemez seviyede.",
    ],
    defenses: [
      "Teknik gereksinimler karşılanabilir düzeyde.",
      "SLA hedefleri gerçekçi.",
    ],
  },
};

// --- Prompt-aware speech generation ---

function pickSpeech(
  agent: StageAgent,
  style: DebateStyle,
  type: "observations" | "objections" | "defenses",
  index: number,
): string {
  const templates = BASE_SPEECH_TEMPLATES[agent.id];

  let baseMsg: string;

  if (!templates) {
    const expertiseStr = agent.expertise.slice(0, 2).join(" ve ");
    const fallbacks: Record<string, string[]> = {
      observations: [
        `${expertiseStr} perspektifinden bu bölüm dikkat gerektiriyor.`,
        `${agent.riskFocus}`,
      ],
      objections: [`${expertiseStr} açısından bu kabul edilemez.`],
      defenses: [`${expertiseStr} açısından bu yeterli.`],
    };
    const arr = fallbacks[type] ?? ["Bu konuyu değerlendiriyorum."];
    baseMsg = arr[index % arr.length];
  } else {
    const arr = templates[type];
    baseMsg = arr[index % arr.length];
  }

  // Apply prompt-derived style modifiers
  const msgType = type === "observations" ? "observation" : type === "objections" ? "objection" : "defense";
  return applyPromptStyleToMessage(baseMsg, style, msgType);
}

// --- Get stage-aware chief agent ---

function getStageChief(): StageAgent {
  const snapshot = getStageAgentSnapshot("chief-agent");
  if (snapshot) return snapshot;
  return {
    ...CHIEF_AGENT,
    hasCustomCV: false,
    tone: "Profesyonel ve net",
    riskFocus: CHIEF_AGENT.characterLine,
    publishedPrompt: null,
  };
}

// --- Build per-agent debate styles ---

function buildAgentStyles(agents: StageAgent[]): Map<string, DebateStyle> {
  const map = new Map<string, DebateStyle>();
  for (const agent of agents) {
    map.set(agent.id, buildDebateStyle(agent.publishedPrompt));
  }
  return map;
}

// --- Generate orchestration sequence ---

export function generateDebateSequence(
  agents: StageAgent[],
  doc: ParsedDocument | null,
  contextNotes: string,
): OrchestrationStep[] {
  const topics = extractTopics(doc, contextNotes);
  const chief = getStageChief();
  const chiefStyle = buildDebateStyle(chief.publishedPrompt);
  const agentStyles = buildAgentStyles(agents);
  const steps: OrchestrationStep[] = [];
  let delay = 0;

  const addStep = (
    deltaMs: number,
    phase: BoardroomPhase,
    agent: StageAgent,
    sceneStatus: AgentSceneState["status"],
    type: DebateEventType,
    message: string,
    topic: string,
  ) => {
    delay += deltaMs;
    steps.push({
      delayMs: delay,
      phase,
      agentId: agent.id,
      agentSceneStatus: sceneStatus,
      topic,
      event: {
        agentId: agent.id,
        agentName: agent.shortName,
        agentAvatar: agent.avatar,
        type,
        message,
        topic,
      },
    });
  };

  const getStyle = (agent: StageAgent) => agentStyles.get(agent.id) ?? buildDebateStyle(null);

  // ── Phase 1: Arrival ──

  addStep(800, "kurul-toplaniyor", chief, "seated",
    "arrival", "Kurul toplanıyor. Belge incelemeye hazırlanıyoruz.", "Kurul");

  agents.forEach((agent) => {
    addStep(600, "kurul-toplaniyor", agent, "seated",
      "arrival", `${agent.shortName} masaya yerleşti.`, "Kurul");
  });

  // ── Phase 2: Review ──

  addStep(1000, "belge-inceleniyor", chief, "reading",
    "observation",
    doc ? `"${doc.fileName}" belgesi incelemeye alınıyor.` : "Belge incelemeye alınıyor.",
    topics[0] || "Genel");

  agents.forEach((agent, i) => {
    const topic = topics[i % topics.length];
    const style = getStyle(agent);
    addStep(800, "belge-inceleniyor", agent, "reading",
      "observation", pickSpeech(agent, style, "observations", 0), topic);
  });

  // ── Phase 3: Debate ──

  agents.forEach((agent, i) => {
    const topic = topics[(i + 1) % topics.length];
    const style = getStyle(agent);
    addStep(900, "tartisma", agent, "analyzing",
      "analysis", pickSpeech(agent, style, "observations", 1), topic);
  });

  if (agents.length >= 2) {
    const objector = agents[0];
    const defender = agents[1];
    const disagreementTopic = topics[1] || topics[0];
    const objStyle = getStyle(objector);
    const defStyle = getStyle(defender);

    addStep(1000, "tartisma", objector, "objecting",
      "objection", pickSpeech(objector, objStyle, "objections", 0), disagreementTopic);

    addStep(800, "tartisma", defender, "defending",
      "defense", pickSpeech(defender, defStyle, "defenses", 0), disagreementTopic);

    addStep(700, "tartisma", objector, "speaking",
      "disagreement",
      `${objector.shortName} ve ${defender.shortName} arasında görüş ayrılığı.`,
      disagreementTopic);
  }

  if (agents.length >= 3) {
    const objector2 = agents[2];
    const topic2 = topics[2] || topics[0];
    const style2 = getStyle(objector2);
    addStep(900, "tartisma", objector2, "objecting",
      "objection", pickSpeech(objector2, style2, "objections", 1), topic2);
  }

  // ── Phase 4: Synthesis ──

  const synthMsg = chiefStyle.conservative
    ? "Kurul görüşleri dikkatle değerlendiriliyor, sentez oluşturuluyor."
    : "Kurul görüşleri değerlendiriliyor, sentez oluşturuluyor.";

  addStep(1200, "karar-olusturuluyor", chief, "synthesizing",
    "synthesis", synthMsg, "Sentez");

  agents.forEach((agent) => {
    addStep(500, "karar-olusturuluyor", agent, "done",
      "synthesis", `${agent.shortName} değerlendirmesini tamamladı.`, "Sentez");
  });

  addStep(1000, "tamamlandi", chief, "done",
    "verdict", "Kurul kararı hazır. Tüm perspektifler değerlendirildi.", "Karar");

  return steps;
}

// --- Generate verdict seed (prompt-aware) ---

export function generateVerdictSeed(
  agents: StageAgent[],
  doc: ParsedDocument | null,
  debateTimeline: DebateEvent[],
): VerdictSeed {
  const docName = doc?.fileName ?? "Belge";
  const objections = debateTimeline.filter((e) => e.type === "objection");
  const disagreements = debateTimeline.filter((e) => e.type === "disagreement");

  // Build verdict style from all agent prompt styles
  const allStyles = agents.map((a) => buildDebateStyle(a.publishedPrompt));
  const verdictStyle = buildVerdictStyleModifier(allStyles);

  const riskLevel: VerdictSeed["riskLevel"] =
    objections.length >= 3 ? "high" : objections.length >= 1 ? "medium" : "low";

  const decisions = [
    `${docName} kontrollu revizyon ile ilerlemeli.`,
    ...(objections.length > 0 ? [`${objections.length} kritik itiraz değerlendirilmeli.`] : []),
    "Nihai onay öncesi revize versiyon kurula sunulmalı.",
  ];

  const actionItems = objections.slice(0, 4).map(
    (e, i) => `${i + 1}. ${e.topic}: ${e.message}`,
  );
  if (actionItems.length === 0) {
    actionItems.push("1. Belge genel değerlendirme ile ilerletilebilir.");
  }

  const agentPerspectives = agents.map((agent) => {
    const agentEvents = debateTimeline.filter((e) => e.agentId === agent.id);
    const lastEvent = agentEvents[agentEvents.length - 1];
    return {
      agentId: agent.id,
      agentName: agent.shortName,
      avatar: agent.avatar,
      position: lastEvent?.message ?? `${agent.shortName} değerlendirmesini tamamladı.`,
    };
  });

  const disagreementList = disagreements.map((e) => {
    const match = e.message.match(/^(.+) ve (.+) arasında/);
    return {
      topic: e.topic,
      agentA: match?.[1] ?? "Ajan A",
      agentB: match?.[2] ?? "Ajan B",
      resolution: "Kurul sentezi ile çözüme kavuşturuldu.",
    };
  });

  const riskLabel = riskLevel === "high" ? "yüksek" : riskLevel === "medium" ? "orta" : "düşük";
  const summaryText = `${verdictStyle.summaryPrefix}${docName} kurul tarafından değerlendirildi. ${objections.length} itiraz, ${disagreements.length} görüş ayrılığı tespit edildi. Risk düzeyi: ${riskLabel}.`;

  return {
    summary: summaryText,
    riskLevel,
    decisions,
    actionItems,
    agentPerspectives,
    disagreements: disagreementList,
  };
}

// ============================================================
// AI Result → Cinematic Orchestration Steps
// ============================================================
//
// Converts a BoardroomAnalysisResult into OrchestrationStep[]
// so AI content plays through the existing cinematic UI.
// ============================================================

/**
 * Convert AI analysis result into cinematic orchestration steps.
 * Scene choreography is controlled; content comes from AI.
 */
export function convertAIResultToSteps(
  aiResult: BoardroomAnalysisResult,
  agents: StageAgent[],
): OrchestrationStep[] {
  const chief = getStageChief();
  const steps: OrchestrationStep[] = [];
  let delay = 0;

  const addStep = (
    deltaMs: number,
    phase: BoardroomPhase,
    agentId: string,
    agentName: string,
    agentAvatar: string,
    sceneStatus: AgentSceneState["status"],
    type: DebateEventType,
    message: string,
    topic: string,
  ) => {
    delay += deltaMs;
    steps.push({
      delayMs: delay,
      phase,
      agentId,
      agentSceneStatus: sceneStatus,
      topic,
      event: { agentId, agentName, agentAvatar, type, message, topic },
    });
  };

  // ── Phase 1: Arrival ──
  addStep(800, "kurul-toplaniyor", chief.id, chief.shortName, chief.avatar, "seated",
    "arrival", "Kurul toplanıyor. Belge incelemeye hazırlanıyoruz.", "Kurul");

  agents.forEach((agent) => {
    addStep(500, "kurul-toplaniyor", agent.id, agent.shortName, agent.avatar, "seated",
      "arrival", `${agent.shortName} masaya yerleşti.`, "Kurul");
  });

  // ── Phase 2: Observations ──
  addStep(800, "belge-inceleniyor", chief.id, chief.shortName, chief.avatar, "reading",
    "observation", "Belge incelemeye alınıyor.", aiResult.observations[0]?.topic ?? "Genel");

  for (const obs of aiResult.observations) {
    const agent = agents.find((a) => a.id === obs.agentId);
    addStep(700, "belge-inceleniyor",
      obs.agentId, obs.agentName, agent?.avatar ?? "👤", "reading",
      obs.type, obs.message, obs.topic);
  }

  // ── Phase 3: Objections & Disagreements ──
  for (const obj of aiResult.objections) {
    const agent = agents.find((a) => a.id === obj.agentId);
    addStep(800, "tartisma",
      obj.agentId, obj.agentName, agent?.avatar ?? "👤", "objecting",
      "objection", obj.message, obj.topic);
  }

  for (const dis of aiResult.disagreements) {
    const agentA = agents.find((a) => a.id === dis.agentAId);
    addStep(600, "tartisma",
      dis.agentAId, dis.agentAName, agentA?.avatar ?? "👤", "objecting",
      "objection", dis.agentAPosition, dis.topic);

    const agentB = agents.find((a) => a.id === dis.agentBId);
    addStep(600, "tartisma",
      dis.agentBId, dis.agentBName, agentB?.avatar ?? "👤", "defending",
      "defense", dis.agentBPosition, dis.topic);

    addStep(500, "tartisma",
      dis.agentAId, dis.agentAName, agentA?.avatar ?? "👤", "speaking",
      "disagreement",
      `${dis.agentAName} ve ${dis.agentBName} arasında görüş ayrılığı.`,
      dis.topic);
  }

  // ── Phase 3b: Rebuttals ──
  if (aiResult.rebuttals && aiResult.rebuttals.length > 0) {
    for (const reb of aiResult.rebuttals) {
      const agent = agents.find((a) => a.id === reb.speakingAgentId);
      const eventType = `rebuttal-${reb.stance}` as DebateEventType;
      addStep(700, "tartisma",
        reb.speakingAgentId, reb.speakingAgentName, agent?.avatar ?? "👤", "rebutting",
        eventType, reb.message, reb.topic);
    }
  }

  // ── Phase 4: Synthesis ──
  addStep(1000, "karar-olusturuluyor", chief.id, chief.shortName, chief.avatar, "synthesizing",
    "synthesis", aiResult.chiefSynthesis, "Sentez");

  agents.forEach((agent) => {
    addStep(400, "karar-olusturuluyor", agent.id, agent.shortName, agent.avatar, "done",
      "synthesis", `${agent.shortName} değerlendirmesini tamamladı.`, "Sentez");
  });

  addStep(800, "tamamlandi", chief.id, chief.shortName, chief.avatar, "done",
    "verdict", "Kurul kararı hazır. Tüm perspektifler değerlendirildi.", "Karar");

  return steps;
}

/**
 * Convert AI verdict into VerdictSeed format.
 */
export function convertAIVerdictToSeed(
  aiResult: BoardroomAnalysisResult,
): VerdictSeed {
  const chiefResult = aiResult.pipeline?.chiefResult;

  // Use structured resolution data from chief when available
  const resolvedDisagreements = chiefResult?.resolvedDisagreements ?? [];
  const unresolvedDisagreements = chiefResult?.unresolvedDisagreements ?? [];
  const positionChanges = chiefResult?.positionChanges ?? [];

  // Legacy disagreements array — combine resolved + unresolved
  const allDisagreements = [
    ...resolvedDisagreements.map((d) => ({
      topic: d.topic,
      agentA: d.agentA,
      agentB: d.agentB,
      resolution: d.resolution,
    })),
    ...unresolvedDisagreements.map((d) => ({
      topic: d.topic,
      agentA: d.agentA,
      agentB: d.agentB,
      resolution: `Çözülemedi: ${d.reason}`,
    })),
  ];

  // Fallback to raw disagreements if chief didn't produce structured data
  const disagreements = allDisagreements.length > 0
    ? allDisagreements
    : aiResult.disagreements.map((d) => ({
        topic: d.topic,
        agentA: d.agentAName,
        agentB: d.agentBName,
        resolution: "Kurul sentezi ile değerlendirildi.",
      }));

  return {
    summary: aiResult.verdict.summary,
    riskLevel: aiResult.verdict.riskLevel,
    confidenceLevel: chiefResult?.confidenceLevel ?? undefined,
    decisions: aiResult.verdict.decisions,
    actionItems: aiResult.verdict.actionItems,
    agentPerspectives: aiResult.verdict.agentPerspectives,
    disagreements,
    resolvedDisagreements: resolvedDisagreements.length > 0 ? resolvedDisagreements : undefined,
    unresolvedDisagreements: unresolvedDisagreements.length > 0
      ? unresolvedDisagreements.map((d) => ({ topic: d.topic, agentA: d.agentA, agentB: d.agentB, reason: d.reason }))
      : undefined,
    positionChanges: positionChanges.length > 0 ? positionChanges : undefined,
  };
}
