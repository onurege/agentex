// PATCH /api/support/[id] — super_admin marks ticket resolved or
// reopens it.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  forbidden,
  getAuthUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const { id } = await ctx.params;
  let body: { status?: unknown } = {};
  try {
    body = (await req.json()) as { status?: unknown };
  } catch {
    return badRequest("Geçersiz JSON.");
  }

  if (body.status !== "open" && body.status !== "resolved") {
    return badRequest("status 'open' veya 'resolved' olmalı.");
  }

  const existing = await prisma.supportTicket.findUnique({ where: { id } });
  if (!existing) return notFound("Talep bulunamadı.");

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: body.status,
      resolvedAt: body.status === "resolved" ? new Date() : null,
      resolvedBy: body.status === "resolved" ? user.id : null,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
    resolvedBy: updated.resolvedBy,
  });
}
