// /api/draft/prompt/saved/[id]
//   GET    → Tek kayıt detayı (document + messages). Sahibi veya aynı grup.
//   DELETE → Yalnız sahibi kaldırabilir.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, getAuthUser, unauthorized } from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const row = await prisma.promptDraft.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!row) {
    return NextResponse.json({ message: "Kayıt bulunamadı." }, { status: 404 });
  }
  const isOwner = row.userId === user.id;
  const isGroupPeer = Boolean(
    user.groupId && row.groupId && user.groupId === row.groupId,
  );
  if (!isOwner && !isGroupPeer) return forbidden();

  return NextResponse.json({
    id: row.id,
    title: row.title,
    document: row.document,
    messages: row.messages,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isOwner,
    ownerName: row.user.name ?? row.user.email,
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId("prompt-draft-delete");
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const existing = await prisma.promptDraft.findUnique({
    where: { id },
    select: { userId: true, title: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Kayıt bulunamadı." }, { status: 404 });
  }
  if (existing.userId !== user.id) return forbidden();

  await prisma.promptDraft.delete({ where: { id } });
  await logAuditEvent({
    action: "prompt_draft_saved",
    targetType: "document",
    targetId: id,
    summary: `Prompt taslağı silindi: ${existing.title}`,
    module: "draft",
    severity: "warning",
    metadata: { deleted: true },
    requestId,
    actorId: user.id,
  });
  return NextResponse.json({ ok: true });
}
