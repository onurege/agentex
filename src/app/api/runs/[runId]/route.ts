import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, canReadRun, getAuthUser, unauthorized, notFound, forbidden } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  // Read access: owner, same-group, or super_admin. Fetch by id only,
  // gate visibility separately so we return 403 vs 404 correctly.
  const run = await prisma.boardRun.findFirst({
    where: { id: params.runId, deletedAt: null },
    include: {
      agentSnapshots: { include: { agentVersion: true } },
      debateMoments: { orderBy: { timestamp: "asc" } },
      verdict: true,
      document: true,
    },
  });

  if (!run) return notFound("Run not found");
  if (!canReadRun(user, run)) return forbidden();

  return NextResponse.json(run);
}

// PATCH supports T-4 organizational edits: rename (documentName) and
// move (folderId). Both are open to anyone with read access on the run
// (same-group + owner + super_admin) so groups can organize together.
// Hard-destructive ops (DELETE) stay restricted to the run's owner.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: { documentName?: unknown; folderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const hasName = body.documentName !== undefined;
  const hasFolder = body.folderId !== undefined;
  if (!hasName && !hasFolder) return badRequest("empty_update");

  if (hasName && (typeof body.documentName !== "string" || body.documentName.trim().length === 0 || body.documentName.length > 200)) {
    return badRequest("invalid_documentName");
  }
  if (hasFolder && body.folderId !== null && typeof body.folderId !== "string") {
    return badRequest("invalid_folderId");
  }

  const run = await prisma.boardRun.findUnique({
    where: { id: params.runId },
    select: {
      id: true,
      userId: true,
      groupId: true,
      deletedAt: true,
      documentName: true,
      folderId: true,
    },
  });
  if (!run || run.deletedAt) return notFound("Run not found");
  if (!canReadRun(user, run)) return forbidden();

  const newName = hasName
    ? (body.documentName as string).trim()
    : run.documentName;
  const newFolderId = hasFolder
    ? (body.folderId === null ? null : (body.folderId as string))
    : run.folderId;

  // Validate that the target folder exists and the user can see it.
  if (hasFolder && newFolderId !== null) {
    const folder = await prisma.runFolder.findUnique({
      where: { id: newFolderId },
      select: { id: true, ownerId: true, groupId: true },
    });
    if (!folder) return notFound("folder_not_found");
    const sharesGroup =
      folder.groupId !== null && folder.groupId === user.groupId;
    const isOwner = folder.ownerId === user.id;
    if (!sharesGroup && !isOwner && user.role !== "super_admin") {
      return forbidden();
    }
  }

  if (run.documentName === newName && run.folderId === newFolderId) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await prisma.$transaction([
    prisma.boardRun.update({
      where: { id: params.runId },
      data: { documentName: newName, folderId: newFolderId },
    }),
    prisma.auditLog.create({
      data: {
        action: hasName && !hasFolder ? "run_renamed" : hasFolder && !hasName ? "run_moved" : "run_updated",
        targetType: "run",
        targetId: params.runId,
        summary: hasName && run.documentName !== newName
          ? `"${run.documentName}" → "${newName}"`
          : hasFolder
            ? `"${run.documentName}" klasörü değiştirildi`
            : `"${run.documentName}" güncellendi`,
        module: "boardroom",
        severity: "info",
        metadata: {
          previousName: run.documentName,
          newName,
          previousFolderId: run.folderId,
          newFolderId,
        },
        actorId: user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
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
