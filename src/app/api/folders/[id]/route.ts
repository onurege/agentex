import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  forbidden,
  getAuthUser,
  notFound,
  unauthorized,
  type SessionUser,
} from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/server-audit";

function canReadFolder(
  viewer: SessionUser,
  folder: { ownerId: string; groupId: string | null },
): boolean {
  if (viewer.role === "super_admin") return true;
  if (folder.ownerId === viewer.id) return true;
  if (folder.groupId !== null && folder.groupId === viewer.groupId) return true;
  return false;
}

// Renaming is open to anyone who can read the folder (same-group write
// access is part of T-4). Deletion is restricted to the owner +
// super_admin to keep accidental destruction within the group bounded.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0 || name.length > 80) return badRequest("invalid_name");

  const folder = await prisma.runFolder.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true, groupId: true },
  });
  if (!folder) return notFound("folder_not_found");
  if (!canReadFolder(user, folder)) return forbidden();
  if (folder.name === name) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await prisma.$transaction([
    prisma.runFolder.update({
      where: { id: params.id },
      data: { name },
    }),
    prisma.auditLog.create({
      data: {
        action: "folder_renamed",
        targetType: "folder",
        targetId: params.id,
        summary: `"${folder.name}" klasörü "${name}" olarak yeniden adlandırıldı`,
        module: "boardroom",
        severity: "info",
        metadata: { previousName: folder.name, newName: name },
        actorId: user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const folder = await prisma.runFolder.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true, groupId: true },
  });
  if (!folder) return notFound("folder_not_found");
  if (folder.ownerId !== user.id && user.role !== "super_admin") {
    return forbidden();
  }

  // FK on BoardRun.folderId is ON DELETE SET NULL — runs survive,
  // they just fall back to root.
  await prisma.runFolder.delete({ where: { id: params.id } });

  await logAuditEvent({
    action: "folder_deleted",
    targetType: "folder",
    targetId: params.id,
    summary: `"${folder.name}" klasörü silindi`,
    module: "boardroom",
    severity: "info",
    metadata: { name: folder.name },
    actorId: user.id,
  });

  return NextResponse.json({ ok: true });
}
