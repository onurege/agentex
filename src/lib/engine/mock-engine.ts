// ============================================================
// MockAnalysisEngine — Seed-data-driven mock implementation
// ============================================================
//
// This engine uses injected AnalysisSeedData to simulate the
// multi-agent analysis pipeline. Seed data is provided by the
// factory — the engine never accesses scenarios directly.
//
// All methods receive ParsedDocument as part of their input,
// establishing the contract that a future LLMAnalysisEngine
// would use to process real document content.
//
// To swap with a real AI engine:
//   1. Create a new class implementing AnalysisEngine
//   2. Use ParsedDocument.sections / fullText for real analysis
//   3. Update the factory in engine/index.ts
// ============================================================

import type {
  AnalysisEngine,
  AnalysisSeedData,
  RecommendationInput,
  AnalysisInput,
  AnalysisOutput,
  SummaryInput,
  SummaryOutput,
  TimelineInput,
} from "./types";
import type {
  ChiefRecommendation,
  ActivityEvent,
  AgentId,
  Finding,
  Disagreement,
  RevisionSuggestion,
  ManagerSummary,
  DiscussionSummary,
} from "../types";
import { AGENTS } from "../agents";

export class MockAnalysisEngine implements AnalysisEngine {
  constructor(private readonly seed: AnalysisSeedData) {}

  // ── Chief Recommendation ──────────────────────────────────

  async generateRecommendation(
    _input: RecommendationInput,
  ): Promise<ChiefRecommendation> {
    // Mock: return pre-seeded recommendation
    // Future LLM engine would analyze input.document.sections here
    return this.seed.chiefRecommendation;
  }

  // ── Analysis Pipeline ─────────────────────────────────────

  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    // Mock: filter seed data by selected agents
    // Future LLM engine would send input.document to each agent
    const selected = new Set(input.selectedAgents);

    return {
      findings: this.seed.findings.filter(
        (f) => selected.has(f.agentId),
      ),
      correctionRequests: this.seed.correctionRequests.filter(
        (cr) => selected.has(cr.fromAgentId) && selected.has(cr.toAgentId),
      ),
      disagreements: this.seed.disagreements.filter(
        (d) => selected.has(d.agentAId) && selected.has(d.agentBId),
      ),
      revisionSuggestions: this.seed.revisionSuggestions.filter(
        (r) => selected.has(r.agentId),
      ),
    };
  }

  // ── Summarization ─────────────────────────────────────────

  async summarize(input: SummaryInput): Promise<SummaryOutput> {
    // Mock: compute scores dynamically from filtered findings
    // Future LLM engine would also use input.document for context
    return {
      managerSummary: computeManagerSummary(
        input.findings,
        input.disagreements,
        input.revisionSuggestions,
        input.contextLabel,
      ),
      discussionSummary: computeDiscussionSummary(
        input.findings,
        input.disagreements,
      ),
    };
  }

  // ── Activity Timeline ─────────────────────────────────────

  buildActivityTimeline(input: TimelineInput): ActivityEvent[] {
    const { selectedAgents, contextLabel } = input;
    const now = Date.now();
    const events: ActivityEvent[] = [];
    let idx = 0;
    const nextId = () => `evt-${String(++idx).padStart(3, "0")}`;

    const has = (id: AgentId) => selectedAgents.includes(id);
    const experts = selectedAgents.filter((id) => id !== "chief-agent");

    // Phase 1: Initialization
    events.push({
      id: nextId(),
      timestamp: now,
      agentId: "chief-agent",
      type: "state-change",
      message: "Baş Ajan incelemeyi başlatıyor",
      detail: `${contextLabel} analiz ediliyor ve inceleme alanları belirleniyor`,
    });

    // Phase 2: Reading (staggered)
    experts.forEach((agentId, i) => {
      const agent = AGENTS[agentId];
      const detail =
        agent.expertise.slice(0, 2).join(" ve ") + " bölümleri taranıyor";
      events.push({
        id: nextId(),
        timestamp: now + 800 + i * 200,
        agentId,
        type: "state-change",
        message: `${agent.shortName} sözleşmeyi okuyor`,
        detail,
      });
    });

    // Phase 3: Critical findings (from seed data)
    const criticalFindings = this.seed.findings.filter(
      (f) => f.severity === "critical" && has(f.agentId),
    );
    criticalFindings.slice(0, 3).forEach((f, i) => {
      events.push({
        id: nextId(),
        timestamp: now + 2500 + i * 500,
        agentId: f.agentId,
        type: "finding",
        message: `Kritik: ${f.title}`,
        detail: f.description.slice(0, 100) + "...",
      });
    });

    // Phase 4: Disagreements (from seed data)
    const activeDisagreements = this.seed.disagreements.filter(
      (d) => has(d.agentAId) && has(d.agentBId),
    );
    activeDisagreements.slice(0, 2).forEach((d, i) => {
      const agentA = AGENTS[d.agentAId];
      const agentB = AGENTS[d.agentBId];
      events.push({
        id: nextId(),
        timestamp: now + 4000 + i * 800,
        agentId: d.agentAId,
        type: "disagreement",
        message: `Tartışma: ${agentA.shortName} ile ${agentB.shortName} — ${d.topic}`,
        detail: `${agentA.shortName}: "${d.positionA.slice(0, 60)}..." / ${agentB.shortName}: "${d.positionB.slice(0, 60)}..."`,
      });
    });

    // Phase 5: Synthesis
    events.push({
      id: nextId(),
      timestamp: now + 5500,
      agentId: "chief-agent",
      type: "synthesis",
      message: "Baş Ajan bulguları sentezliyor",
      detail:
        "Anlaşmazlıklar çözümleniyor ve nihai değerlendirme hazırlanıyor",
    });

    // Phase 6: Complete
    const filteredFindings = this.seed.findings.filter((f) => has(f.agentId));
    const filteredCritical = filteredFindings.filter(
      (f) => f.severity === "critical",
    ).length;
    events.push({
      id: nextId(),
      timestamp: now + 6500,
      agentId: "chief-agent",
      type: "complete",
      message: `Analiz tamamlandı — ${filteredFindings.length} bulgu, ${activeDisagreements.length} anlaşmazlık çözümlendi`,
      detail: `${filteredCritical} kritik sorun revizyon gerektiriyor.`,
    });

    return events;
  }
}

// ── Private Summary Computation ───────────────────────────────

function computeManagerSummary(
  filteredFindings: Finding[],
  filteredDisagreements: Disagreement[],
  filteredRevisions: RevisionSuggestion[],
  scenarioName: string,
): ManagerSummary {
  const criticals = filteredFindings.filter((f) => f.severity === "critical");
  const warnings = filteredFindings.filter((f) => f.severity === "warning");
  const positives = filteredFindings.filter((f) => f.severity === "positive");

  // Dynamic score: 100 - (critical*10 + warning*5 - positive*3)
  const rawScore =
    100 - criticals.length * 10 - warnings.length * 5 + positives.length * 3;
  const contractHealthScore = Math.max(15, Math.min(95, rawScore));

  // Risk level
  const riskLevel: "high" | "medium" | "low" =
    criticals.length >= 4 ? "high" : criticals.length >= 2 ? "medium" : "low";

  // Key findings — derived from criticals + warnings
  const keyFindings = [
    ...criticals.map((f) => f.title),
    ...warnings
      .slice(0, Math.max(0, 5 - criticals.length))
      .map((f) => f.title),
  ].slice(0, 5);

  // Recommended actions — derived from revisions
  const recommendedActions = filteredRevisions
    .map((r) => `${r.section}: ${r.rationale.slice(0, 80)}...`)
    .slice(0, 6);

  // Fallback: derive actions from critical findings
  if (recommendedActions.length === 0) {
    criticals.forEach((f) => {
      recommendedActions.push(
        `${f.clause || f.section || ""}: ${f.title} — düzeltme gerekli`,
      );
    });
  }

  // Dynamic assessment text
  const parts: string[] = [];
  parts.push(
    `Bu ${scenarioName} incelemesinde toplam ${filteredFindings.length} bulgu tespit edilmiştir.`,
  );
  if (criticals.length > 0) {
    parts.push(
      `${criticals.length} kritik sorun imzalanmadan önce mutlaka ele alınmalıdır.`,
    );
  }
  if (warnings.length > 0) {
    parts.push(`${warnings.length} uyarı niteliğinde eksiklik giderilmelidir.`);
  }
  if (positives.length > 0) {
    parts.push(`${positives.length} madde olumlu değerlendirilmiştir.`);
  }
  if (filteredDisagreements.length > 0) {
    const resolved = filteredDisagreements.filter((d) => d.resolution).length;
    parts.push(
      `${filteredDisagreements.length} anlaşmazlıktan ${resolved} tanesi çözüme kavuşturulmuştur.`,
    );
  }
  parts.push(
    `Önerilen revizyonlarla sözleşme daha dengeli ve uygulanabilir hale getirilebilir.`,
  );

  return {
    overallAssessment: parts.join(" "),
    contractHealthScore,
    keyFindings,
    recommendedActions,
    riskLevel,
  };
}

function computeDiscussionSummary(
  filteredFindings: Finding[],
  filteredDisagreements: Disagreement[],
): DiscussionSummary {
  const consensusPoints = filteredFindings
    .filter((f) => f.severity === "positive")
    .map((f) => {
      const agent = AGENTS[f.agentId];
      return `${agent.shortName}: ${f.title}`;
    });

  const debateHighlights = filteredDisagreements.map((d) => {
    const agentA = AGENTS[d.agentAId];
    const agentB = AGENTS[d.agentBId];
    const note = d.resolution ? ` — ${d.resolution.slice(0, 60)}...` : "";
    return `${agentA.shortName} ile ${agentB.shortName}: ${d.topic}${note}`;
  });

  return {
    totalFindings: filteredFindings.length,
    criticalIssues: filteredFindings.filter((f) => f.severity === "critical")
      .length,
    disagreements: filteredDisagreements.length,
    consensusPoints,
    debateHighlights,
  };
}
