// ============================================================
// POST /api/draft/explain
// ============================================================
//
// aiSuggestable=true olan bir soru için kullanıcıya yönelik
// kısa hukuki bağlam açıklaması üretir.
// Body: { templateId, questionId }
// Response: { explanation }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { badRequest, getAuthUser, unauthorized } from "@/lib/api-auth";
import { getTemplate } from "@/lib/draft/templates/registry";
import {
  ExplainValidationError,
  explainQuestion,
} from "@/lib/draft/ai/explain";
import type { TemplateId } from "@/lib/draft/types";

export const runtime = "nodejs";

interface ExplainPayload {
  templateId: TemplateId;
  questionId: string;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let payload: ExplainPayload;
  try {
    payload = (await req.json()) as ExplainPayload;
  } catch {
    return badRequest("Geçersiz JSON gövdesi.");
  }

  if (!payload.templateId || !payload.questionId) {
    return badRequest("Eksik alan: templateId / questionId.");
  }

  const template = getTemplate(payload.templateId);
  if (!template) {
    return badRequest(`Bilinmeyen şablon: ${payload.templateId}`);
  }

  try {
    const result = await explainQuestion({
      template,
      questionId: payload.questionId,
    });
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof ExplainValidationError) {
      return badRequest(err.message);
    }
    const message =
      err instanceof Error ? err.message : "Açıklama üretilemedi.";
    return NextResponse.json(
      { error: `Gemini hatası: ${message}` },
      { status: 502 },
    );
  }
}
