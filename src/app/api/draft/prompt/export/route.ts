// POST /api/draft/prompt/export
//
// Prompt taslağını DOCX'e dönüştürür. Body: { draft: PromptDraftDocument }
// Response: application/vnd.openxmlformats-officedocument.wordprocessingml.document

import { NextRequest, NextResponse } from "next/server";
import { badRequest, getAuthUser, unauthorized } from "@/lib/api-auth";
import { buildPromptDraftDocx } from "@/lib/draft-prompt/docx-export";
import type { PromptDraftDocument } from "@/lib/draft-prompt/types";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export const runtime = "nodejs";

function isDraft(v: unknown): v is PromptDraftDocument {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.title === "string" &&
    typeof r.preamble === "string" &&
    typeof r.closing === "string" &&
    Array.isArray(r.clauses)
  );
}

function safeFilename(title: string): string {
  const base =
    title
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "sozlesme";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-${stamp}.docx`;
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("draft-prompt-export");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let payload: { draft?: unknown };
  try {
    payload = (await req.json()) as { draft?: unknown };
  } catch {
    return badRequest("Geçersiz JSON gövdesi.");
  }
  if (!isDraft(payload.draft)) {
    return badRequest("Eksik veya geçersiz alan: draft.");
  }

  try {
    const buffer = await buildPromptDraftDocx(payload.draft);
    await logAuditEvent({
      action: "draft_exported",
      targetType: "document",
      targetId: null,
      summary: `Prompt taslağı DOCX indirildi: ${payload.draft.title}`,
      module: "draft",
      severity: "info",
      metadata: {
        clauseCount: payload.draft.clauses.length,
        sizeBytes: buffer.byteLength,
      },
      requestId,
      actorId: user.id,
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename(payload.draft.title)}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DOCX üretilemedi.";
    return NextResponse.json(
      { error: "export_failed", message },
      { status: 500 },
    );
  }
}
