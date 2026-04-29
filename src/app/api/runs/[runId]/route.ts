import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const run = await prisma.boardRun.findFirst({
    where: { id: params.runId, userId: user.id, deletedAt: null },
    include: {
      agentSnapshots: { include: { agentVersion: true } },
      debateMoments: { orderBy: { timestamp: "asc" } },
      verdict: true,
      document: true,
    },
  });

  if (!run) return notFound("Run not found");

  return NextResponse.json(run);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const run = await prisma.boardRun.findFirst({
    where: { id: params.runId, userId: user.id, deletedAt: null },
  });

  if (!run) return notFound("Run not found");

  await prisma.$transaction([
    prisma.boardRun.update({
      where: { id: params.runId },
      data: { deletedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        action: "run_deleted",
        targetType: "run",
        targetId: params.runId,
        summary: `"${run.documentName}" çalıştırması silindi`,
        module: "boardroom",
        severity: "warning",
        metadata: { documentName: run.documentName },
        actorId: user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
