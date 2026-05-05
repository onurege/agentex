// ============================================================
// Boardroom Analysis API Route — Multi-step Gemini pipeline
// ============================================================
//
// Four-stage pipeline:
//   1. Agent Pass: per-agent observations (parallel)
//   2. Disagreement Pass: cross-agent tension detection
//   3. Rebuttal Pass: agents respond to opposing positions
//   4. Chief Pass: synthesis and verdict
//
// Each stage has independent error handling. Partial failures
// produce partial results rather than total failure.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/engine/gemini/client";
import type { BoardroomAnalysisInput, BoardroomAnalysisResult, PipelineStageInfo } from "@/lib/boardroom-engine/types";
import { buildAgentPassPrompt, normalizeAgentPassResult, type AgentPassResult } from "@/lib/boardroom-engine/agent-pass";
import { buildDisagreementPassPrompt, normalizeDisagreementPassResult, type DisagreementPassResult } from "@/lib/boardroom-engine/disagreement-pass";
import { buildPerAgentRebuttalPrompt, normalizePerAgentRebuttalResult, type RebuttalPassResult, type RebuttalEntry } from "@/lib/boardroom-engine/rebuttal-pass";
import type { DisagreementPassEntry } from "@/lib/boardroom-engine/disagreement-pass";
import { buildChiefPassPrompt, normalizeChiefPassResult, type ChiefPassResult } from "@/lib/boardroom-engine/chief-pass";
import { buildStanceDirective } from "@/lib/boardroom-engine/prompts";
import { matchClause, type MatchableParagraph } from "@/lib/redline/clause-matcher";
import type { ArbitratedEdit } from "@/lib/redline/types";
import { formatLegalResearchForPrompt, runLegalResearchPass, shouldRunLegalResearch } from "@/lib/legal-research/research-pass";
import type { LegalResearchResult } from "@/lib/legal-research/types";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export async function POST(request: NextRequest) {
  const pipelineStart = Date.now();
  const requestId = createRequestId("boardroom");
  const stages: PipelineStageInfo[] = [];
  const model = process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "gemini-2.0-flash";
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const input = body.input as BoardroomAnalysisInput;

    const stanceDirective = buildStanceDirective(
      input?.clientParty ?? "",
      input?.stance ?? "objective",
    );

    if (!input || !input.agents || input.agents.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid boardroom analysis input" },
        { status: 400 },
      );
    }

    await logAuditEvent({
      action: "boardroom_started",
      targetType: "pipeline",
      targetId: input.document.fileName,
      summary: `"${input.document.fileName}" için agent kurulu başlatıldı`,
      module: "boardroom",
      requestId,
      actorId: user.id,
      metadata: {
        agentIds: input.agents.map((agent) => agent.id),
        sectionCount: input.document.sections.length,
        hasFullText: Boolean(input.document.fullText),
      },
    });

    // ── Stage 0: Legal Research Pass (Yargı MCP, gated) ──

    let legalResearchResult: LegalResearchResult | null = null;
    let legalResearchContext = "";

    if (shouldRunLegalResearch(input)) {
      const researchStart = Date.now();
      try {
        await logAuditEvent({
          action: "legal_research_started",
          targetType: "mcp",
          targetId: "yargi-mcp",
          summary: "Yargı MCP canlı araştırması başlatıldı",
          module: "boardroom",
          requestId,
          actorId: user.id,
          metadata: { documentName: input.document.fileName },
        });
        legalResearchResult = await runLegalResearchPass(input);
        legalResearchContext = formatLegalResearchForPrompt(legalResearchResult);
        stages.push({
          stage: "legal-research-pass",
          status: legalResearchResult.sources.length > 0 ? "success" : "failed",
          durationMs: Date.now() - researchStart,
          agentId: "case-law-researcher",
          error: legalResearchResult.sources.length > 0
            ? undefined
            : legalResearchResult.warnings.join(" | ") || "Yargı MCP kaynak sonucu üretmedi.",
        });
        await logAuditEvent({
          action: legalResearchResult.sources.length > 0
            ? "legal_research_completed"
            : "legal_research_failed",
          targetType: "mcp",
          targetId: "yargi-mcp",
          summary: `Yargı MCP araştırması ${legalResearchResult.sources.length} kaynak ile tamamlandı`,
          module: "boardroom",
          severity: legalResearchResult.sources.length > 0 ? "info" : "warning",
          requestId,
          actorId: user.id,
          metadata: {
            queries: legalResearchResult.queries,
            sourceCount: legalResearchResult.sources.length,
            warnings: legalResearchResult.warnings,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Legal research pass failed:", message);
        legalResearchResult = {
          enabled: true,
          provider: "yargi-mcp",
          endpoint: process.env.YARGI_MCP_URL?.trim() || "https://yargimcp.fastmcp.app/mcp",
          queries: [],
          sources: [],
          warnings: [message],
        };
        legalResearchContext = formatLegalResearchForPrompt(legalResearchResult);
        stages.push({
          stage: "legal-research-pass",
          status: "failed",
          durationMs: Date.now() - researchStart,
          agentId: "case-law-researcher",
          error: message,
        });
        await logAuditEvent({
          action: "legal_research_failed",
          targetType: "mcp",
          targetId: "yargi-mcp",
          summary: `Yargı MCP araştırması başarısız: ${message}`,
          module: "boardroom",
          severity: "warning",
          requestId,
          actorId: user.id,
          metadata: { error: message },
        });
      }
    } else {
      stages.push({ stage: "legal-research-pass", status: "skipped", durationMs: 0 });
    }

    // ── Stage 1: Agent Pass (parallel per-agent calls) ──

    const agentResults: AgentPassResult[] = [];

    const agentPromises = input.agents.map(async (agent) => {
      const stageStart = Date.now();
      try {
        const prompt = buildAgentPassPrompt(
          agent,
          input.document,
          input.contextNotes,
          stanceDirective,
          agent.id === "case-law-researcher" ? legalResearchContext : undefined,
        );
        const raw = await generateJSON(prompt);
        const result = normalizeAgentPassResult(raw as Record<string, unknown>, agent);
        stages.push({ stage: "agent-pass", status: "success", durationMs: Date.now() - stageStart, agentId: agent.id });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Agent pass failed for ${agent.id}:`, message);
        stages.push({ stage: "agent-pass", status: "failed", durationMs: Date.now() - stageStart, agentId: agent.id, error: message });
        return normalizeAgentPassResult({}, agent);
      }
    });

    const agentSettled = await Promise.all(agentPromises);
    agentResults.push(...agentSettled);

    const successfulAgents = stages.filter((s) => s.stage === "agent-pass" && s.status === "success").length;

    // ── Stage 2: Disagreement Pass (gated) ──
    // Faz 4: disabled by default to shorten the critical path from
    // ~60s to ~25s. Turn on via BOARDROOM_ENABLE_DISAGREEMENT_PASS=true
    // for debate-heavy documents where the explicit tension detection
    // still earns its keep.

    const enableDisagreement = process.env.BOARDROOM_ENABLE_DISAGREEMENT_PASS === "true";
    let disagreementResult: DisagreementPassResult | null = null;

    if (enableDisagreement && successfulAgents >= 2) {
      const disStart = Date.now();
      try {
        const prompt = buildDisagreementPassPrompt(agentResults, input.document.fileName);
        const raw = await generateJSON(prompt);
        disagreementResult = normalizeDisagreementPassResult(raw as Record<string, unknown>);
        stages.push({ stage: "disagreement-pass", status: "success", durationMs: Date.now() - disStart });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Disagreement pass failed:", message);
        stages.push({ stage: "disagreement-pass", status: "failed", durationMs: Date.now() - disStart, error: message });
        disagreementResult = { disagreements: [], consensusPoints: [] };
      }
    } else {
      stages.push({ stage: "disagreement-pass", status: "skipped", durationMs: 0 });
      disagreementResult = { disagreements: [], consensusPoints: [] };
    }

    // ── Stage 3: Rebuttal Pass (gated) ──
    // Faz 4: disabled by default. Only runs when both the flag is on
    // AND disagreement-pass produced at least one tension to rebut
    // against — otherwise there's nothing for agents to respond to.

    const enableRebuttal = process.env.BOARDROOM_ENABLE_REBUTTAL_PASS === "true";
    let rebuttalResult: RebuttalPassResult | null = null;

    if (enableRebuttal && disagreementResult && disagreementResult.disagreements.length > 0) {
      // Find involved agents and their relevant disagreements
      const involvedAgentIds = new Set<string>();
      for (const d of disagreementResult.disagreements) {
        involvedAgentIds.add(d.agentAId);
        involvedAgentIds.add(d.agentBId);
      }

      const allRebuttals: RebuttalEntry[] = [];

      // Per-agent rebuttal calls (parallel)
      const rebuttalPromises = Array.from(involvedAgentIds).map(async (agentId) => {
        const agent = input.agents.find((a) => a.id === agentId);
        const agentResult = agentResults.find((ar) => ar.agentId === agentId);
        if (!agent || !agentResult) return;

        // Find disagreements involving this agent
        const relevant = disagreementResult!.disagreements.filter(
          (d: DisagreementPassEntry) => d.agentAId === agentId || d.agentBId === agentId,
        );
        if (relevant.length === 0) return;

        const rebStart = Date.now();
        try {
          const prompt = buildPerAgentRebuttalPrompt(agent, agentResult, relevant);
          const raw = await generateJSON(prompt);
          const entries = normalizePerAgentRebuttalResult(raw as Record<string, unknown>, agent, relevant);
          allRebuttals.push(...entries);
          stages.push({ stage: "rebuttal-pass", status: "success", durationMs: Date.now() - rebStart, agentId });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`Rebuttal pass failed for ${agentId}:`, message);
          stages.push({ stage: "rebuttal-pass", status: "failed", durationMs: Date.now() - rebStart, agentId, error: message });
        }
      });

      await Promise.all(rebuttalPromises);
      rebuttalResult = { rebuttals: allRebuttals };
    } else {
      stages.push({ stage: "rebuttal-pass", status: "skipped", durationMs: 0 });
      rebuttalResult = { rebuttals: [] };
    }

    // ── Stage 4: Chief Pass ──

    let chiefResult: ChiefPassResult | null = null;
    const chiefStart = Date.now();

    try {
      const prompt = buildChiefPassPrompt(
        agentResults,
        disagreementResult,
        rebuttalResult,
        input.document.fileName,
        input.contextNotes,
        stanceDirective,
      );
      const raw = await generateJSON(prompt);
      chiefResult = normalizeChiefPassResult(raw as Record<string, unknown>, agentResults);
      stages.push({ stage: "chief-pass", status: "success", durationMs: Date.now() - chiefStart });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Chief pass failed:", message);
      stages.push({ stage: "chief-pass", status: "failed", durationMs: Date.now() - chiefStart, error: message });
    }

    // ── Faz 4: Hallucination guard on arbitrated edits ──
    // Chief can reference clauseRefs that don't line up with any
    // paragraph in the document (either hallucinated or misspelled).
    // Run the 3-layer matcher; unmatched edits get resolution
    // orphan_unmatched and won't reach the redline renderer, but they
    // stay in the result for UI ("N öneri belge yapısıyla eşleşmedi").

    // buildAnalysisInput slimmed sections down to { title, content,
    // clauseRef } — id and nested clauses don't make the trip. Build
    // candidate paragraphs from what we have.
    const paragraphCandidates: MatchableParagraph[] = [];
    input.document.sections.forEach((section, i) => {
      const ref = section.clauseRef ? `${section.clauseRef} ` : "";
      paragraphCandidates.push({
        id: `section-${i}`,
        text: `${ref}${section.title} ${section.content.slice(0, 200)}`.trim(),
      });
    });

    const guardedEdits: ArbitratedEdit[] = [];
    if (chiefResult) {
      for (const edit of chiefResult.arbitratedEdits) {
        const match = matchClause(edit.clauseRef, paragraphCandidates);
        if (match.kind === "orphan" && paragraphCandidates.length > 0) {
          guardedEdits.push({ ...edit, resolution: "orphan_unmatched" });
        } else {
          guardedEdits.push(edit);
        }
      }
    }

    // ── Assemble result ──

    const failedStages = stages.filter((s) => s.status === "failed");
    const analysisMode: BoardroomAnalysisResult["analysisMode"] =
      failedStages.length === 0 ? "ai" :
      successfulAgents >= 1 && chiefResult ? "ai-partial" :
      "fallback";

    const observations = agentResults.flatMap((ar) =>
      ar.observations.map((obs) => ({
        agentId: ar.agentId,
        agentName: ar.agentName,
        message: obs.message,
        topic: obs.topic,
        type: "observation" as const,
        sectionRef: obs.sectionRef,
        severity: obs.severity,
      })),
    );

    const objections = agentResults.flatMap((ar) =>
      ar.observations
        .filter((obs) => obs.severity === "critical" || obs.severity === "warning")
        .map((obs) => ({
          agentId: ar.agentId,
          agentName: ar.agentName,
          message: obs.message,
          topic: obs.topic,
        })),
    );

    const disagreements = (disagreementResult?.disagreements ?? []).map((d) => ({
      topic: d.topic,
      agentAId: d.agentAId,
      agentAName: d.agentAName,
      agentAPosition: d.agentAPosition,
      agentBId: d.agentBId,
      agentBName: d.agentBName,
      agentBPosition: d.agentBPosition,
    }));

    const rebuttals = (rebuttalResult?.rebuttals ?? []).map((r) => ({
      speakingAgentId: r.speakingAgentId,
      speakingAgentName: r.speakingAgentName,
      targetAgentName: r.targetAgentName,
      topic: r.topic,
      message: r.message,
      stance: r.stance,
    }));

    const verdict = chiefResult
      ? {
          summary: chiefResult.summary,
          riskLevel: chiefResult.riskLevel,
          decisions: chiefResult.decisions,
          actionItems: chiefResult.actionItems,
          agentPerspectives: chiefResult.agentPerspectives,
        }
      : {
          summary: `${input.document.fileName} kurul tarafından değerlendirildi. ${objections.length} endişe tespit edildi.`,
          riskLevel: (objections.length >= 3 ? "high" : objections.length >= 1 ? "medium" : "low") as "high" | "medium" | "low",
          decisions: agentResults.map((ar) => ar.suggestedAction),
          actionItems: agentResults.map((ar, i) => `${i + 1}. ${ar.keyConcern}`),
          agentPerspectives: agentResults.map((ar) => ({
            agentId: ar.agentId,
            agentName: ar.agentName,
            avatar: ar.avatar,
            position: ar.overallPosition,
          })),
        };

    const result: BoardroomAnalysisResult = {
      observations,
      objections,
      disagreements,
      rebuttals,
      chiefSynthesis: chiefResult?.synthesis ?? "Kurul görüşleri değerlendirildi.",
      verdict,
      arbitratedEdits: guardedEdits,
      pipeline: {
        legalResearchResult,
        agentResults,
        disagreementResult,
        rebuttalResult,
        chiefResult,
        stages,
      },
      analysisMode,
      modelInfo: model,
      legalResearch: legalResearchResult,
    };

    await logAuditEvent({
      action: "boardroom_completed",
      targetType: "pipeline",
      targetId: input.document.fileName,
      summary: `"${input.document.fileName}" agent kurul analizi tamamlandı`,
      module: "boardroom",
      severity: analysisMode === "fallback" ? "warning" : "info",
      requestId,
      actorId: user.id,
      metadata: {
        analysisMode,
        modelInfo: model,
        durationMs: Date.now() - pipelineStart,
        stageCount: stages.length,
        failedStages: stages.filter((stage) => stage.status === "failed").length,
        legalResearchSources: legalResearchResult?.sources.length ?? 0,
      },
    });

    return NextResponse.json({
      result,
      diagnostics: { durationMs: Date.now() - pipelineStart, stages },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Boardroom pipeline error:", message);
    await logAuditEvent({
      action: "boardroom_failed",
      targetType: "pipeline",
      targetId: "boardroom",
      summary: `Agent kurul pipeline hatası: ${message}`,
      module: "boardroom",
      severity: "error",
      requestId,
      actorId: user.id,
      metadata: { error: message, durationMs: Date.now() - pipelineStart },
    });
    return NextResponse.json(
      { error: message, diagnostics: { durationMs: Date.now() - pipelineStart, stages } },
      { status: 500 },
    );
  }
}
