// ============================================================
// POST /api/signatures/precheck
// ============================================================
//
// Stateless pre-check for the signatures module. The client extracts
// raw text from the sirkü and dilekçe PDFs (existing PdfParser, runs
// in-browser so the bytes never leave the user) and POSTs the strings
// here. The server runs deterministic regex extraction + the six-check
// comparison engine, emits an audit event with severity matching the
// outcome, and returns the structured PrecheckResult.
//
// AI fallback (Gemini Vision for stamp images that text extraction
// can't read) is intentionally out of scope for this commit — the
// regex path covers the typed-text case which is the bulk of real
// documents. The route shape is forward-compatible with adding a
// vision_only branch later.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthUser,
  unauthorized,
} from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";
import {
  extractPetition,
  extractSirku,
} from "@/lib/signatures/precheck/extract";
import {
  comparePrecheck,
  computeOverallStatus,
} from "@/lib/signatures/precheck/compare";
import type { PrecheckResult } from "@/lib/signatures/precheck/types";

export const runtime = "nodejs";

const MAX_TEXT_BYTES = 1 * 1024 * 1024; // 1 MB plain text per side

export async function POST(req: NextRequest) {
  const requestId = createRequestId("precheck");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: {
    sirkuText?: string;
    petitionText?: string;
    sirkuFileName?: string;
    petitionFileName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (
    typeof body.sirkuText !== "string" ||
    typeof body.petitionText !== "string"
  ) {
    return badRequest("sirkuText ve petitionText alanları gerekli.");
  }
  if (
    body.sirkuText.length > MAX_TEXT_BYTES ||
    body.petitionText.length > MAX_TEXT_BYTES
  ) {
    return badRequest("Belge metni 1 MB sınırını aşıyor.");
  }
  if (
    body.sirkuText.trim().length === 0 ||
    body.petitionText.trim().length === 0
  ) {
    return badRequest("Belge metni boş olamaz.");
  }

  const sirku = extractSirku(body.sirkuText);
  const petition = extractPetition(body.petitionText);
  const checks = comparePrecheck(sirku, petition);
  const status = computeOverallStatus(checks);

  const result: PrecheckResult = {
    status,
    checks,
    sirku,
    petition,
    extractionMode: "regex",
    generatedAt: new Date().toISOString(),
  };

  const failedCheckIds = checks
    .filter((c) => c.severity === "critical")
    .map((c) => c.id);
  const warningCheckIds = checks
    .filter((c) => c.severity === "warning")
    .map((c) => c.id);

  await logAuditEvent({
    action:
      status === "failed"
        ? "signature_precheck_failed"
        : status === "warned"
          ? "signature_precheck_warned"
          : "signature_precheck_passed",
    targetType: "signature",
    targetId: body.sirkuFileName || body.petitionFileName || "precheck",
    summary:
      status === "failed"
        ? "İmza ön kontrolünde kritik uyumsuzluk tespit edildi"
        : status === "warned"
          ? "İmza ön kontrolünde uyarılar var"
          : "İmza ön kontrolü tutarlı",
    module: "signatures",
    severity:
      status === "failed"
        ? "error"
        : status === "warned"
          ? "warning"
          : "info",
    metadata: {
      extractionMode: "regex",
      failedCheckIds,
      warningCheckIds,
      sirku: {
        companyName: sirku.companyName,
        taxNumber: sirku.taxNumber,
        authorityType: sirku.authorityType,
        authorityStart: sirku.authorityStart,
        authorityDurationYears: sirku.authorityDurationYears,
      },
      petition: {
        companyName: petition.companyName,
        taxNumber: petition.taxNumber,
        petitionDate: petition.petitionDate,
      },
      sirkuFileName: body.sirkuFileName ?? null,
      petitionFileName: body.petitionFileName ?? null,
    },
    requestId,
    actorId: user.id,
  });

  return NextResponse.json({ result, requestId });
}
