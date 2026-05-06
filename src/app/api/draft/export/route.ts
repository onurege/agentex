// ============================================================
// POST /api/draft/export
// ============================================================
//
// Draft oturumunu alır, sunucu tarafında renderDraft ile madde
// metinlerini çözer ve docx lib aracılığıyla DOCX'e dönüştürür.
// Oturum verisi tarayıcıdaki store'dan geldiği için sunucuda
// persistence yok; auth'lu kullanıcıdan gelen isteği doğrudan
// işler.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { badRequest, getAuthUser, unauthorized } from "@/lib/api-auth";
import { buildDraftDocx } from "@/lib/draft/docx-export";
import { renderDraft } from "@/lib/draft/renderer";
import { getTemplate } from "@/lib/draft/templates/registry";
import type { DraftSession, TemplateId } from "@/lib/draft/types";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export const runtime = "nodejs";

interface ExportPayload {
  templateId: TemplateId;
  answers?: Record<string, unknown>;
  aiAccepted?: Record<string, string>;
  disabledClauses?: string[];
  manualEdits?: Record<string, { title?: string; body?: string }>;
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("draft");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let payload: ExportPayload;
  try {
    payload = (await req.json()) as ExportPayload;
  } catch {
    return badRequest("Geçersiz JSON gövdesi.");
  }

  if (!payload.templateId) {
    return badRequest("Eksik alan: templateId.");
  }

  const template = getTemplate(payload.templateId);
  if (!template) {
    return badRequest(`Bilinmeyen şablon: ${payload.templateId}`);
  }

  const now = new Date().toISOString();
  const session: DraftSession = {
    id: payload.sessionId ?? `srv_${Date.now()}`,
    templateId: payload.templateId,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    answers: payload.answers ?? {},
    aiAccepted: payload.aiAccepted ?? {},
    disabledClauses: payload.disabledClauses ?? [],
    manualEdits: payload.manualEdits ?? {},
  };

  const { clauses } = renderDraft(template, session);
  if (clauses.length === 0) {
    return badRequest("Sözleşme boş; soruları doldurun.");
  }

  const buffer = await buildDraftDocx({
    template,
    session,
    renderedClauses: clauses,
  });

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const baseName = sanitizeFileName(template.label);
  const outName = `${baseName}-${today}.docx`;
  const asciiName = outName.replace(/[^\x20-\x7E]/g, "_");

  await logAuditEvent({
    action: "draft_exported",
    targetType: "draft",
    targetId: session.id,
    summary: `"${template.label}" sözleşme taslağı DOCX olarak indirildi`,
    module: "draft",
    requestId,
    actorId: user.id,
    metadata: {
      templateId: payload.templateId,
      clauseCount: clauses.length,
      answeredQuestionCount: Object.keys(session.answers).length,
      disabledClauseCount: session.disabledClauses.length,
      fileName: outName,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(outName)}`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}

function sanitizeFileName(input: string): string {
  return (
    input
      .replace(/[()]/g, "")
      .replace(/[^\wçğıöşüÇĞİÖŞÜ.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "sozlesme"
  );
}
