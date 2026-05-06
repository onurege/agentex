import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, forbidden, notFound } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/server-audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();

  const group = await prisma.group.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!group) return notFound("group_not_found");

  // FK is ON DELETE SET NULL — Prisma cascades the unset for User.groupId
  // and BoardRun.groupId automatically. No manual unsetting needed.
  await prisma.group.delete({ where: { id: params.id } });

  await logAuditEvent({
    action: "group_deleted",
    targetType: "group",
    targetId: params.id,
    summary: `"${group.name}" grubu silindi`,
    module: "admin",
    severity: "warning",
    metadata: { name: group.name },
    actorId: caller.id,
  });

  return NextResponse.json({ ok: true });
}
