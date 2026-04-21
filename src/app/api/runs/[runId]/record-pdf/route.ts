// ============================================================
// GET /api/runs/[runId]/record-pdf
// ============================================================
//
// Streams a PDF of the run's negotiation record (cover + verdict +
// agent perspectives + disagreements + position changes + action
// items). Mirrors the redline route's auth + filename pattern.
//
// Rendering runs server-side via @react-pdf/renderer.renderToBuffer,
// which takes a React element — we build it with React.createElement
// so this file can stay .ts (Next.js Route Handlers don't officially
// accept .tsx).
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, getAuthUser, notFound, unauthorized } from "@/lib/api-auth";
import {
  renderNegotiationRecordPdf,
  type NegotiationRecordData,
} from "@/lib/export/negotiation-pdf";
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
  // shape is what the client/engine always writes, so the cast is
  // safe. Missing optional fields fall through as undefined.
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

  const buffer = await renderNegotiationRecordPdf(data);

  const baseName = run.documentName.replace(/\.[^.]+$/, "");
  const fileName = `muzakere-kaydi-${baseName}.pdf`;
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
