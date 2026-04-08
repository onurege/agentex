// ============================================================
// Discussion Scene — Deterministic event sequence (Turkish)
// Maps to the orchestration timing in orchestration.ts
// Dynamically adapts to selected agents and active scenario.
// ============================================================

import type { AgentId, DemoScenario } from "./types";
import type { SceneEvent } from "./scene-types";
import { AGENTS } from "./agents";

/**
 * Build the full scene event sequence for a given set of selected agents.
 * Events reference only agents that are actually selected.
 * The sequence is designed to match the ~6.5s orchestration timeline.
 */
export function buildSceneEvents(selectedAgents: AgentId[], scenario?: DemoScenario | null): SceneEvent[] {
  const has = (id: AgentId) => selectedAgents.includes(id);
  const experts = selectedAgents.filter((id) => id !== "chief-agent");

  const events: SceneEvent[] = [
    // === Faz 1: OKUMA (0–2000ms) ===
    {
      delay: 200,
      agentId: "chief-agent",
      text: "İncelemeyi koordine ediyorum. Herkes okumaya başlasın.",
      variant: "normal",
    },
  ];

  // Seçili uzman ajanları sırayla okumaya başlat
  experts.forEach((agentId, i) => {
    const agent = AGENTS[agentId];
    const detailText = agent.expertise.slice(0, 2).join(" ve ") + " bölümleri taranıyor.";
    events.push({
      delay: 900 + i * 200,
      agentId,
      text: detailText.charAt(0).toUpperCase() + detailText.slice(1),
      variant: "normal",
    });
  });

  // === Faz 2: BULGULAR (2000–4000ms) ===
  // Senaryodaki kritik bulguları seçili ajanlardan yayınla
  if (scenario) {
    const criticals = scenario.findings.filter(
      (f) => f.severity === "critical" && has(f.agentId),
    );
    criticals.slice(0, 3).forEach((f, i) => {
      events.push({
        delay: 2400 + i * 500,
        agentId: f.agentId,
        text: f.description.slice(0, 80) + "...",
        variant: "normal",
      });
    });
  } else {
    // Senaryo yoksa genel bulgular
    if (has("legal-counsel")) {
      events.push({
        delay: 2400,
        agentId: "legal-counsel",
        text: "Kritik bir sorumluluk maddesi tespit edildi.",
        variant: "normal",
      });
    }
    if (has("finance-director")) {
      events.push({
        delay: 2900,
        agentId: "finance-director",
        text: "Finansal koşullarda belirsizlik var.",
        variant: "normal",
      });
    }
  }

  // === Faz 3: ÇATIŞMA (4000–5500ms) ===
  // Senaryodaki anlaşmazlıkları kullan (her iki ajan da seçiliyse)
  if (scenario) {
    const activeDisagreements = scenario.disagreements.filter(
      (d) => has(d.agentAId) && has(d.agentBId),
    );
    if (activeDisagreements.length > 0) {
      const d = activeDisagreements[0];
      events.push({
        delay: 4100,
        agentId: d.agentAId,
        text: d.positionA.slice(0, 70) + "...",
        variant: "disagreement",
      });
      events.push({
        delay: 4600,
        agentId: d.agentBId,
        text: d.positionB.slice(0, 70) + "...",
        variant: "disagreement",
      });
    }
  } else {
    // Fallback: ilk iki farklı uzman arasında tartışma
    if (experts.length >= 2) {
      events.push({
        delay: 4100,
        agentId: experts[0],
        text: "Bu madde tamamen kaldırılmalı. Mevcut hali kabul edilemez.",
        variant: "disagreement",
      });
      events.push({
        delay: 4600,
        agentId: experts[1],
        text: "Kaldırmak yerine revize edilmeli. Tamamen silmek riski artırır.",
        variant: "disagreement",
      });
    }
  }

  // === Faz 4: SENTEZ (5500–6500ms) ===
  if (scenario) {
    const activeDisagreements = scenario.disagreements.filter(
      (d) => has(d.agentAId) && has(d.agentBId),
    );
    const resolution = activeDisagreements[0]?.resolution;
    events.push({
      delay: 5600,
      agentId: "chief-agent",
      text: resolution
        ? resolution.slice(0, 80) + "..."
        : "Tüm bulgular değerlendirildi. Nihai sentez hazırlanıyor.",
      variant: "synthesis",
    });
  } else {
    events.push({
      delay: 5600,
      agentId: "chief-agent",
      text: "Çatışmalar değerlendirildi. Uzlaşıya dayalı sentez hazırlanıyor.",
      variant: "synthesis",
    });
  }

  // Tamamlanma
  const filteredFindings = scenario
    ? scenario.findings.filter((f) => has(f.agentId))
    : [];
  const criticalCount = filteredFindings.filter((f) => f.severity === "critical").length;

  events.push({
    delay: 6300,
    agentId: "chief-agent",
    text: scenario
      ? `İnceleme tamamlandı. ${filteredFindings.length} bulgu, ${criticalCount} kritik sorun tespit edildi.`
      : "İnceleme tamamlandı.",
    variant: "complete",
  });

  return events.sort((a, b) => a.delay - b.delay);
}
