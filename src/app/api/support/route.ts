// /api/support
//
// POST: any authenticated user creates a ticket (title + content).
// GET:  super_admin only — list tickets with optional status filter.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, getAuthUser, unauthorized } from "@/lib/api-auth";

const TITLE_MAX = 140;
const CONTENT_MAX = 4000;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: { title?: unknown; content?: unknown } = {};
  try {
    body = (await req.json()) as { title?: unknown; content?: unknown };
  } catch {
    return badRequest("Geçersiz JSON.");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (title.length === 0 || title.length > TITLE_MAX) {
    return badRequest(`Başlık 1-${TITLE_MAX} karakter olmalı.`);
  }
  if (content.length === 0 || content.length > CONTENT_MAX) {
    return badRequest(`İçerik 1-${CONTENT_MAX} karakter olmalı.`);
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      title,
      content,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    id: ticket.id,
    createdAt: ticket.createdAt.toISOString(),
  });
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const url = req.nextUrl;
  const statusParam = url.searchParams.get("status");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
    200,
  );

  const where: { status?: string } = {};
  if (statusParam === "open" || statusParam === "resolved") {
    where.status = statusParam;
  }

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  const counts = await prisma.supportTicket.groupBy({
    by: ["status"],
    _count: true,
  });
  const summary = { open: 0, resolved: 0 };
  for (const c of counts) {
    if (c.status === "open") summary.open = c._count;
    else if (c.status === "resolved") summary.resolved = c._count;
  }

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      title: t.title,
      content: t.content,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
      resolvedBy: t.resolvedBy,
      user: {
        id: t.user.id,
        email: t.user.email,
        name: t.user.name,
        role: t.user.role,
      },
    })),
    summary,
  });
}
