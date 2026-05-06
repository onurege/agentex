import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, getAuthUser, unauthorized } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/server-audit";

// Folders are scoped by visibility, same as runs:
//   - super_admin: sees everything (group + groupless folders).
//   - group member: sees folders that share the viewer's groupId,
//     plus the user's own private folders if they have any.
//   - groupless user: sees only their own folders.
// Server enforces the same scope on POST so a user can't create a
// folder owned by someone else's group.

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const where: import("@prisma/client").Prisma.RunFolderWhereInput = {};
  if (user.role !== "super_admin") {
    where.OR = user.groupId
      ? [{ groupId: user.groupId }, { ownerId: user.id, groupId: null }]
      : [{ ownerId: user.id }];
  }

  const folders = await prisma.runFolder.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ownerId: true,
      groupId: true,
      createdAt: true,
      _count: { select: { runs: { where: { deletedAt: null } } } },
    },
  });

  return NextResponse.json(
    folders.map((f) => ({
      id: f.id,
      name: f.name,
      ownerId: f.ownerId,
      groupId: f.groupId,
      createdAt: f.createdAt.toISOString(),
      runCount: f._count.runs,
      isOwn: f.ownerId === user.id,
    })),
  );
}

export async function POST(req: Request) {
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

  const folder = await prisma.runFolder.create({
    data: {
      name,
      ownerId: user.id,
      // Freeze the user's current group; same-group members get
      // immediate read+write access via the GET filter and PATCH gate.
      groupId: user.groupId ?? null,
    },
  });

  await logAuditEvent({
    action: "folder_created",
    targetType: "folder",
    targetId: folder.id,
    summary: `"${name}" klasörü oluşturuldu`,
    module: "boardroom",
    severity: "info",
    metadata: { name, groupId: folder.groupId },
    actorId: user.id,
  });

  return NextResponse.json({
    id: folder.id,
    name: folder.name,
    ownerId: folder.ownerId,
    groupId: folder.groupId,
    createdAt: folder.createdAt.toISOString(),
    runCount: 0,
    isOwn: true,
  });
}
