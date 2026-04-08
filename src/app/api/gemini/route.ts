// ============================================================
// Gemini API Route — server-side proxy for Gemini calls
// ============================================================
//
// This route keeps the Gemini API key server-only.
// The client sends structured input data, and the server:
//   1. Builds the prompt from the input
//   2. Calls Gemini via the SDK
//   3. Normalizes the response + runs quality guards
//   4. Returns the app-friendly result with diagnostics
//
// The client never sees the API key, prompts, or raw Gemini output.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/engine/gemini/client";
import {
  buildRecommendationPrompt,
  buildManagerSummaryPrompt,
  buildDiscussionSummaryPrompt,
  buildRevisionSuggestionsPrompt,
  buildDisagreementsPrompt,
  buildFindingsPrompt,
} from "@/lib/engine/gemini/prompts";
import {
  normalizeRecommendationWithReport,
  normalizeManagerSummaryWithReport,
  normalizeDiscussionSummaryWithReport,
  normalizeRevisionSuggestions,
  normalizeDisagreements,
  normalizeFindings,
} from "@/lib/engine/gemini/normalize";
import type { NormalizationReport } from "@/lib/engine/gemini/diagnostics";

// --- Action Types ---

type GeminiAction =
  | "recommendation"
  | "managerSummary"
  | "discussionSummary"
  | "revisionSuggestions"
  | "disagreements"
  | "findings";

const VALID_ACTIONS = new Set<GeminiAction>([
  "recommendation",
  "managerSummary",
  "discussionSummary",
  "revisionSuggestions",
  "disagreements",
  "findings",
]);

// --- Helpers ---

function respond(
  result: unknown,
  normalization: NormalizationReport,
  durationMs: number,
) {
  return NextResponse.json({
    result,
    diagnostics: { normalization, durationMs },
  });
}

// --- Route Handler ---

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { action, input } = body;

    if (!action || !VALID_ACTIONS.has(action as GeminiAction)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400 },
      );
    }

    if (!input) {
      return NextResponse.json(
        { error: "Missing input" },
        { status: 400 },
      );
    }

    switch (action as GeminiAction) {
      case "recommendation": {
        const prompt = buildRecommendationPrompt(
          input.document,
          input.businessContext,
        );
        const raw = await generateJSON(prompt);
        const { result, report } = normalizeRecommendationWithReport(
          raw as Record<string, unknown>,
        );
        return respond(result, report, Date.now() - startTime);
      }

      case "managerSummary": {
        const prompt = buildManagerSummaryPrompt(
          input.document,
          input.findings,
          input.disagreements,
          input.revisionSuggestions,
          input.contextLabel,
        );
        const raw = await generateJSON(prompt);
        const { result, report } = normalizeManagerSummaryWithReport(
          raw as Record<string, unknown>,
        );
        return respond(result, report, Date.now() - startTime);
      }

      case "discussionSummary": {
        const prompt = buildDiscussionSummaryPrompt(
          input.document,
          input.findings,
          input.disagreements,
          input.contextLabel,
        );
        const raw = await generateJSON(prompt);
        const { result, report } = normalizeDiscussionSummaryWithReport(
          raw as Record<string, unknown>,
          input.actualFindings ?? 0,
          input.actualCritical ?? 0,
          input.actualDisagreements ?? 0,
        );
        return respond(result, report, Date.now() - startTime);
      }

      case "revisionSuggestions": {
        const prompt = buildRevisionSuggestionsPrompt(
          input.document,
          input.findings,
          input.selectedAgents,
          input.contextLabel,
        );
        const raw = await generateJSON(prompt);
        const validAgents = new Set<string>(input.selectedAgents ?? []);
        const { result, report } = normalizeRevisionSuggestions(
          raw as Record<string, unknown>,
          validAgents,
        );
        return respond(result, report, Date.now() - startTime);
      }

      case "disagreements": {
        const prompt = buildDisagreementsPrompt(
          input.document,
          input.findings,
          input.selectedAgents,
          input.contextLabel,
        );
        const raw = await generateJSON(prompt);
        const validAgents = new Set<string>(input.selectedAgents ?? []);
        const { result, report } = normalizeDisagreements(
          raw as Record<string, unknown>,
          validAgents,
        );
        return respond(result, report, Date.now() - startTime);
      }

      case "findings": {
        const prompt = buildFindingsPrompt(
          input.document,
          input.businessContext,
          input.agentId,
          input.contextLabel,
        );
        const raw = await generateJSON(prompt);
        const { result, report } = normalizeFindings(
          raw as Record<string, unknown>,
          input.agentId,
        );
        return respond(result, report, Date.now() - startTime);
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 },
        );
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Gemini API route error:", message);
    return NextResponse.json(
      { error: message, diagnostics: { durationMs: Date.now() - startTime } },
      { status: 500 },
    );
  }
}
