// ============================================================
// POST /api/compare/redline
// ============================================================
//
// Stateless DOCX redline export for the compare module. The client
// sends v1's original DOCX + the CompareFinding[] computed by the
// deterministic diff engine; the server translates findings into
// ArbitratedEdits and runs the Faz 4 redline renderer over the
// buffer, streaming the rewritten DOCX back as a download.
//
// No DB persistence — compare runs live in browser storage only.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthUser,
  unauthorized,
} from "@/lib/api-auth";
import { applyRedline } from "@/lib/redline/docx-renderer";
import { findingsToEdits } from "@/lib/compare/findings-to-edits";
import type { CompareFinding } from "@/lib/compare/types";
import { MAX_DOCX_BYTES } from "@/lib/ingestion/docx-guard";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = createRequestId("compare");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("multipart/form-data gövdesi bekleniyor.");
  }

  const docx = form.get("docx");
  const findingsRaw = form.get("findings");
  const fileNameRaw = form.get("fileName");

  if (!(docx instanceof Blob)) return badRequest("Eksik alan: docx.");
  if (typeof findingsRaw !== "string") return badRequest("Eksik alan: findings.");
  if (docx.size > MAX_DOCX_BYTES) {
    return badRequest("DOCX 10 MB sınırını aşıyor.");
  }

  let findings: CompareFinding[];
  try {
    findings = JSON.parse(findingsRaw) as CompareFinding[];
  } catch {
    return badRequest("findings alanı geçerli JSON değil.");
  }
  if (!Array.isArray(findings)) {
    return badRequest("findings bir dizi olmalı.");
  }

  const { edits, skippedCount } = findingsToEdits(findings);
  if (edits.length === 0) {
    return badRequest("Redline'a aktarılabilecek değişiklik yok.");
  }

  const arrayBuffer = await docx.arrayBuffer();
  const nodeBuffer = Buffer.from(arrayBuffer);

  const result = await applyRedline(nodeBuffer, edits, {
    author: "Consulera · Compare",
  });

  const rawName =
    typeof fileNameRaw === "string" && fileNameRaw.length > 0
      ? fileNameRaw
      : "contract.docx";
  const baseName =
    rawName.replace(/\.docx$/i, "").replace(/[^\w.\-]/g, "_") || "compare";
  const outName = `${baseName}-redline.docx`;
  const asciiName = outName.replace(/[^\x20-\x7E]/g, "_");

  await logAuditEvent({
    action: "compare_redline_exported",
    targetType: "compare",
    targetId: baseName,
    summary: `"${rawName}" karşılaştırma redline çıktısı indirildi`,
    module: "compare",
    requestId,
    actorId: user.id,
    metadata: {
      inputFileName: rawName,
      findingCount: findings.length,
      editCount: edits.length,
      appliedCount: result.appliedCount,
      orphanCount: result.orphanCount,
      skippedCount,
      outputFileName: outName,
    },
  });

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(outName)}`,
      "Content-Length": String(result.buffer.length),
      "X-Applied-Count": String(result.appliedCount),
      "X-Orphan-Count": String(result.orphanCount),
      "X-Skipped-Count": String(skippedCount),
      "Cache-Control": "private, no-store",
    },
  });
}
