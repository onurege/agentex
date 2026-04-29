import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/server-audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const template = await prisma.boardTemplate.findFirst({
    where: { id: params.id, deletedAt: null },
  });

  if (!template) return notFound("Template not found");

  await prisma.boardTemplate.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await logAuditEvent({
    action: "template_deleted",
    targetType: "template",
    targetId: params.id,
    summary: `"${template.name}" şablonu silindi`,
    module: "control_room",
    severity: "warning",
    actorId: user.id,
    metadata: { deleted: true, ownerId: template.ownerId },
  });

  return NextResponse.json({ ok: true });
}
