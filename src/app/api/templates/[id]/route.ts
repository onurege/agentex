import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound } from "@/lib/api-auth";

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

  return NextResponse.json({ ok: true });
}
