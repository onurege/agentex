// ============================================================
// Boardroom Engine Types
// ============================================================
//
// Normalized output types for multi-step AI boardroom analysis.
// Pipeline: Agent Pass → Disagreement Pass → Chief Pass
// ============================================================

import type { AgentPassResult } from "./agent-pass";
import type { DisagreementPassResult } from "./disagreement-pass";
import type { RebuttalPassResult } from "./rebuttal-pass";
import type { ChiefPassResult } from "./chief-pass";
import type { ArbitratedEdit } from "../redline/types";
import type { LegalResearchResult } from "../legal-research/types";

// --- Re-export pass types for convenience ---
export type { AgentPassResult } from "./agent-pass";
export type { DisagreementPassResult, DisagreementPassEntry } from "./disagreement-pass";
export type { RebuttalPassResult, RebuttalEntry, RebuttalStance } from "./rebuttal-pass";
export type { ChiefPassResult, ChiefPassPerspective, ResolvedDisagreement, UnresolvedDisagreement, PositionChange } from "./chief-pass";

// --- Legacy compat types (still consumed by orchestrator) ---

export interface AgentObservation {
  agentId: string;
  agentName: string;
  message: string;
  topic: string;
  type: "observation" | "analysis";
  sectionRef?: string;
  severity?: "info" | "warning" | "critical";
}

export interface AgentObjection {
  agentId: string;
  agentName: string;
  message: string;
  topic: string;
}

export interface AgentDisagreement {
  topic: string;
  agentAId: string;
  agentAName: string;
  agentAPosition: string;
  agentBId: string;
  agentBName: string;
  agentBPosition: string;
}

export interface AgentPerspective {
  agentId: string;
  agentName: string;
  avatar: string;
  position: string;
}

// --- Pipeline stage metadata ---

export interface PipelineStageInfo {
  stage: "legal-research-pass" | "agent-pass" | "disagreement-pass" | "rebuttal-pass" | "chief-pass";
  status: "success" | "failed" | "skipped";
  durationMs: number;
  agentId?: string;
  error?: string;
}

// --- Full analysis result ---

export interface BoardroomAnalysisResult {
  // Flattened outputs for orchestrator consumption
  observations: AgentObservation[];
  objections: AgentObjection[];
  disagreements: AgentDisagreement[];
  chiefSynthesis: string;
  verdict: {
    summary: string;
    riskLevel: "high" | "medium" | "low";
    decisions: string[];
    actionItems: string[];
    agentPerspectives: AgentPerspective[];
  };

  // Flattened rebuttals for orchestrator
  rebuttals: Array<{
    speakingAgentId: string;
    speakingAgentName: string;
    targetAgentName: string;
    topic: string;
    message: string;
    stance: string;
  }>;

  // Pipeline raw outputs (for richer saved runs)
  pipeline: {
    legalResearchResult: LegalResearchResult | null;
    agentResults: AgentPassResult[];
    disagreementResult: DisagreementPassResult | null;
    rebuttalResult: RebuttalPassResult | null;
    chiefResult: ChiefPassResult | null;
    stages: PipelineStageInfo[];
  };

  // Metadata
  analysisMode: "ai" | "ai-partial" | "fallback";
  modelInfo?: string;
  legalResearch?: LegalResearchResult | null;

  // Faz 4: canonical redline-ready edits after chief arbitration +
  // hallucination guard. Empty when pipeline produces no edits or all
  // were orphaned.
  arbitratedEdits: ArbitratedEdit[];
}

// --- Input shape ---

export interface BoardroomAnalysisInput {
  agents: Array<{
    id: string;
    name: string;
    shortName: string;
    title: string;
    avatar: string;
    expertise: string[];
    tone: string;
    riskFocus: string;
    thinkingStyle: string;
    systemPrompt?: string;
    rolePrompt?: string;
    outputRules?: string;
    guardrails?: string;
  }>;
  document: {
    fileName: string;
    fullText: string | null;
    sections: Array<{ title: string; content: string; clauseRef?: string }>;
  };
  contextNotes: string;
  // Representation context — required, set in setup screen.
  // Stance steers every agent prompt and the chief verdict.
  clientParty: string;
  stance: "aggressive" | "favor" | "objective" | "winwin";
}
