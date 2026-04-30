// POST /api/regulations/[id]/read
//
// Per-user okundu / pinned işareti. Body: { pinned?: boolean }.
// Upsert against (userId, regulationId) UNIQUE — readAt always
// refreshed, pinned toggled if provided.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  getAuthUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const requestId = createRequestId("regulations");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: { pinned?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const pinned = body && typeof body.pinned === "boolean" ? body.pinned : null;

  const regulation = await prisma.regulationItem.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!regulation) return notFound("regulation_not_found");

  const now = new Date();
  const existing = await prisma.regulationRead.findUnique({
    where: {
      userId_regulationId: {
        userId: user.id,
        regulationId: regulation.id,
      },
    },
    select: { id: true, pinned: true },
  });

  const nextPinned = pinned !== null ? pinned : (existing?.pinned ?? false);

  if (existing) {
    await prisma.regulationRead.update({
      where: { id: existing.id },
      data: { readAt: now, pinned: nextPinned },
    });
  } else {
    await prisma.regulationRead.create({
      data: {
        userId: user.id,
        regulationId: regulation.id,
        pinned: nextPinned,
      },
    });
  }

  if (pinned !== null) {
    await logAuditEvent({
      action: "regulation_pinned",
      targetType: "regulation",
      targetId: regulation.id,
      summary: pinned
        ? `Mevzuat işaretlendi: "${regulation.title}"`
        : `Mevzuat işareti kaldırıldı: "${regulation.title}"`,
      module: "regulations",
      severity: "info",
      metadata: { pinned },
      requestId,
      actorId: user.id,
    });
  }

  if (pinned === null && !body) {
    return badRequest("invalid_body");
  }

  return NextResponse.json({ ok: true, pinned: nextPinned });
}
