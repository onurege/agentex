// ============================================================
// POST /api/draft/suggest
// ============================================================
//
// Belirli bir aiEditable madde için Gemini'den daha iyi bir
// yazım önerir. Kullanıcı önerdiği metni store'daki aiAccepted
// altına kabul ederse, renderer bu override'ı kullanır ve preview
// anlık günceller.
//
// Body: { templateId, clauseId, answers, aiAccepted, disabledClauses }
// Response (200): { suggestedText, rationale }
// 400: doğrulama hatası; 502: Gemini hatası.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { badRequest, getAuthUser, unauthorized } from "@/lib/api-auth";
import { getTemplate } from "@/lib/draft/templates/registry";
import {
  SuggestValidationError,
  suggestClause,
} from "@/lib/draft/ai/suggest";
import type { TemplateId } from "@/lib/draft/types";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export const runtime = "nodejs";

interface SuggestPayload {
  templateId: TemplateId;
  clauseId: string;
  answers?: Record<string, unknown>;
  aiAccepted?: Record<string, string>;
  disabledClauses?: string[];
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("draft");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let payload: SuggestPayload;
  try {
    payload = (await req.json()) as SuggestPayload;
  } catch {
    return badRequest("Geçersiz JSON gövdesi.");
  }

  if (!payload.templateId || !payload.clauseId) {
    return badRequest("Eksik alan: templateId / clauseId.");
  }

  const template = getTemplate(payload.templateId);
  if (!template) {
    return badRequest(`Bilinmeyen şablon: ${payload.templateId}`);
  }

  try {
    const result = await suggestClause({
      template,
      clauseId: payload.clauseId,
      answers: payload.answers ?? {},
      aiAccepted: payload.aiAccepted ?? {},
      disabledClauses: payload.disabledClauses ?? [],
    });

    await logAuditEvent({
      action: "draft_ai_suggested",
      targetType: "draft",
      targetId: `${payload.templateId}:${payload.clauseId}`,
      summary: `"${payload.templateId}" şablonunda AI madde önerisi üretildi`,
      module: "draft",
      requestId,
      actorId: user.id,
      metadata: {
        templateId: payload.templateId,
        clauseId: payload.clauseId,
        disabledClauseCount: payload.disabledClauses?.length ?? 0,
      },
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof SuggestValidationError) {
      return badRequest(err.message);
    }
    const message =
      err instanceof Error ? err.message : "AI önerisi üretilemedi.";
    await logAuditEvent({
      action: "api_error",
      targetType: "draft",
      targetId: `${payload.templateId}:${payload.clauseId}`,
      summary: `Taslak AI önerisi üretilemedi: ${message}`,
      module: "draft",
      severity: "error",
      requestId,
      actorId: user.id,
      metadata: { templateId: payload.templateId, clauseId: payload.clauseId, error: message },
    });
    return NextResponse.json(
      { error: `Gemini hatası: ${message}` },
      { status: 502 },
    );
  }
}
