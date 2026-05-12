// /api/draft/prompt/saved
//   GET  → Sahibi veya aynı grupta olduğu kayıtlı prompt taslaklarını listeler.
//   POST → Yeni PromptDraft yaratır veya `id` verilmişse günceller (yalnız sahibi).

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, getAuthUser, unauthorized, forbidden } from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";
import type {
  PromptChatMessage,
  PromptDraftDocument,
} from "@/lib/draft-prompt/types";

export const runtime = "nodejs";

interface SavePayload {
  id?: string;
  document?: unknown;
  messages?: unknown;
}

function isDocument(v: unknown): v is PromptDraftDocument {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.title === "string" &&
    typeof r.preamble === "string" &&
    typeof r.closing === "string" &&
    Array.isArray(r.clauses)
  );
}

function isMessageList(v: unknown): v is PromptChatMessage[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (m) =>
      m &&
      typeof m === "object" &&
      typeof (m as Record<string, unknown>).id === "string" &&
      ((m as Record<string, unknown>).role === "user" ||
        (m as Record<string, unknown>).role === "assistant") &&
      typeof (m as Record<string, unknown>).content === "string" &&
      typeof (m as Record<string, unknown>).createdAt === "string",
  );
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const where: Prisma.PromptDraftWhereInput = user.groupId
    ? { OR: [{ userId: user.id }, { groupId: user.groupId }] }
    : { userId: user.id };

  const rows = await prisma.promptDraft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      userId: true,
      groupId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      isOwner: r.userId === user.id,
      ownerName: r.user.name ?? r.user.email,
    })),
  });
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("prompt-draft-save");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let payload: SavePayload;
  try {
    payload = (await req.json()) as SavePayload;
  } catch {
    return badRequest("Geçersiz JSON gövdesi.");
  }
  if (!isDocument(payload.document)) {
    return badRequest("Eksik veya geçersiz alan: document.");
  }
  if (!isMessageList(payload.messages)) {
    return badRequest("Eksik veya geçersiz alan: messages.");
  }

  const title = (payload.document.title || "Adsız sözleşme").slice(0, 200);

  if (payload.id) {
    const existing = await prisma.promptDraft.findUnique({
      where: { id: payload.id },
      select: { userId: true },
    });
    if (!existing) return badRequest("Kayıt bulunamadı.");
    if (existing.userId !== user.id) return forbidden();

    const updated = await prisma.promptDraft.update({
      where: { id: payload.id },
      data: {
        title,
        document: payload.document as unknown as Prisma.InputJsonValue,
        messages: payload.messages as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, updatedAt: true },
    });
    await logAuditEvent({
      action: "prompt_draft_saved",
      targetType: "document",
      targetId: updated.id,
      summary: `Prompt taslağı güncellendi: ${title}`,
      module: "draft",
      severity: "info",
      metadata: { clauseCount: payload.document.clauses.length },
      requestId,
      actorId: user.id,
    });
    return NextResponse.json({
      id: updated.id,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  const created = await prisma.promptDraft.create({
    data: {
      userId: user.id,
      groupId: user.groupId ?? null,
      title,
      document: payload.document as unknown as Prisma.InputJsonValue,
      messages: payload.messages as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });
  await logAuditEvent({
    action: "prompt_draft_saved",
    targetType: "document",
    targetId: created.id,
    summary: `Prompt taslağı kaydedildi: ${title}`,
    module: "draft",
    severity: "info",
    metadata: { clauseCount: payload.document.clauses.length },
    requestId,
    actorId: user.id,
  });
  return NextResponse.json({
    id: created.id,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
}
