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

// Türkçe karakterleri ASCII'ye indirgeyerek HTTP header güvenli
// `filename="…"` üretir. Orijinal başlık RFC 5987 `filename*` ile
// UTF-8 olarak ayrı verilir; modern tarayıcılar onu tercih eder.
function asciiFilename(title: string): string {
  const map: Record<string, string> = {
    ç: "c", Ç: "C",
    ğ: "g", Ğ: "G",
    ı: "i", İ: "I",
    ö: "o", Ö: "O",
    ş: "s", Ş: "S",
    ü: "u", Ü: "U",
  };
  const folded = title.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => map[c] ?? c);
  const stripped = folded.replace(/[^\x20-\x7E]/g, "").trim();
  const base =
    stripped
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "sozlesme";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-${stamp}.docx`;
}

function utf8Filename(title: string): string {
  const base =
    title
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "sozlesme";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-${stamp}.docx`;
}

function contentDispositionHeader(title: string): string {
  const ascii = asciiFilename(title);
  const utf8 = utf8Filename(title);
  // RFC 5987 encoding for the UTF-8 variant.
  const encoded = encodeURIComponent(utf8)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
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
        "Content-Disposition": contentDispositionHeader(payload.draft.title),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DOCX üretilemedi.";
    console.error("[draft-prompt:export] failure", err);
    return NextResponse.json(
      { error: "export_failed", message },
      { status: 500 },
    );
  }
}
