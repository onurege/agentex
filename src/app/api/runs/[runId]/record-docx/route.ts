// ============================================================
// GET /api/runs/[runId]/record-docx
// ============================================================
//
// Streams a Word-native negotiation-record DOCX of the run. Mirrors
// the redline route's auth + filename pattern. Rendering happens in
// negotiation-docx.ts via the `docx` package (declarative OOXML —
// no headless browser or font embedding needed).
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, getAuthUser, notFound, unauthorized } from "@/lib/api-auth";
import {
  renderNegotiationRecordDocx,
  type NegotiationRecordData,
} from "@/lib/export/negotiation-docx";
import type { VerdictSeed } from "@/lib/boardroom-flow-store";

export async function GET(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const run = await prisma.boardRun.findUnique({
    where: { id: params.runId },
    select: {
      userId: true,
      deletedAt: true,
      documentName: true,
      startedAt: true,
      verdict: true,
    },
  });
  if (!run || run.deletedAt) return notFound("Run not found");
  if (run.userId !== user.id && user.role !== "super_admin") return forbidden();
  if (!run.verdict) return notFound("Verdict not available for this run");

  // Prisma returns the JSON columns as `unknown`; the VerdictSeed
  // shape is what the engine always writes, so the cast is safe.
  const v = run.verdict;
  const verdict: VerdictSeed = {
    summary: v.summary,
    riskLevel: v.riskLevel as VerdictSeed["riskLevel"],
    confidenceLevel:
      (v.confidenceLevel as VerdictSeed["confidenceLevel"]) ?? undefined,
    decisions: v.decisions as string[],
    actionItems: v.actionItems as string[],
    agentPerspectives:
      v.agentPerspectives as VerdictSeed["agentPerspectives"],
    disagreements: v.disagreements as VerdictSeed["disagreements"],
    resolvedDisagreements:
      (v.resolvedDisagreements as VerdictSeed["resolvedDisagreements"]) ??
      undefined,
    unresolvedDisagreements:
      (v.unresolvedDisagreements as VerdictSeed["unresolvedDisagreements"]) ??
      undefined,
    positionChanges:
      (v.positionChanges as VerdictSeed["positionChanges"]) ?? undefined,
  };

  const data: NegotiationRecordData = {
    documentName: run.documentName,
    runId: params.runId,
    generatedAt: run.startedAt.toISOString(),
    verdict,
  };

  const buffer = await renderNegotiationRecordDocx(data);

  const baseName = run.documentName.replace(/\.[^.]+$/, "");
  const fileName = `muzakere-kaydi-${baseName}.docx`;
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
