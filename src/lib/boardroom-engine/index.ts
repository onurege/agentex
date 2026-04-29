// ============================================================
// Boardroom Engine — Public API
// ============================================================
//
// Multi-step AI Boardroom analysis pipeline:
//   1. Agent Pass (per-agent observations)
//   2. Disagreement Pass (cross-agent tension detection)
//   3. Chief Pass (synthesis + verdict)
//
// Client-side: calls the server-side API route.
// Server-side: orchestrates Gemini calls with per-stage fallback.
// ============================================================

export type {
  BoardroomAnalysisResult,
  BoardroomAnalysisInput,
  AgentObservation,
  AgentObjection,
  AgentDisagreement,
  AgentPerspective,
  PipelineStageInfo,
  AgentPassResult,
  DisagreementPassResult,
  RebuttalPassResult,
  RebuttalEntry,
  RebuttalStance,
  ChiefPassResult,
} from "./types";
export type { LegalResearchResult, LegalResearchSource } from "../legal-research/types";

export type { AgentPassObservation } from "./agent-pass";
export type { DisagreementPassEntry } from "./disagreement-pass";
export type { ChiefPassPerspective } from "./chief-pass";

import type { BoardroomAnalysisInput, BoardroomAnalysisResult } from "./types";
import type { StageAgent } from "../stage-agents";
import type { ParsedDocument } from "../ingestion/types";

/**
 * Build the analysis input from stage-facing data.
 */
export function buildAnalysisInput(
  agents: StageAgent[],
  doc: ParsedDocument | null,
  contextNotes: string,
): BoardroomAnalysisInput {
  return {
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      shortName: a.shortName,
      title: a.title,
      avatar: a.avatar,
      expertise: a.expertise,
      tone: a.tone,
      riskFocus: a.riskFocus,
      thinkingStyle: a.thinkingStyle,
      systemPrompt: a.publishedPrompt?.systemPrompt,
      rolePrompt: a.publishedPrompt?.rolePrompt,
      outputRules: a.publishedPrompt?.outputRules,
      guardrails: a.publishedPrompt?.guardrails,
    })),
    document: {
      fileName: doc?.fileName ?? "Belge",
      fullText: doc?.fullText ?? null,
      sections: (doc?.sections ?? []).map((s) => ({
        title: s.title,
        content: s.content,
        clauseRef: s.clauseRef,
      })),
    },
    contextNotes,
  };
}

/**
 * Run multi-step boardroom analysis via the server-side API.
 * Returns normalized result or throws on total failure.
 */
export async function callBoardroomAnalysisAPI(
  input: BoardroomAnalysisInput,
): Promise<BoardroomAnalysisResult> {
  const res = await fetch("/api/boardroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "API call failed" }));
    throw new Error(err.error ?? `API error: ${res.status}`);
  }

  const data = await res.json();
  return data.result as BoardroomAnalysisResult;
}
