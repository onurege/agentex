import { NextRequest, NextResponse } from "next/server";
import { BOARDROOM_AGENTS } from "@/lib/boardroom-agents";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  getAuthUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";

const SYSTEM_KEYS = new Set<string>([
  "chief-agent",
  ...BOARDROOM_AGENTS.map((a) => a.id),
]);

export async function PUT(
  req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let prompt: import("@prisma/client").Prisma.InputJsonValue;
  try {
    prompt = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (SYSTEM_KEYS.has(params.agentKey)) {
    await prisma.agentProfile.upsert({
      where: {
        agentKey_ownerId: { agentKey: params.agentKey, ownerId: user.id },
      },
      create: {
        agentKey: params.agentKey,
        ownerId: user.id,
        promptDraft: prompt,
        promptLastSaved: new Date(),
      },
      update: {
        promptDraft: prompt,
        promptLastSaved: new Date(),
      },
    });
  } else {
    // Custom agent — row must already exist (POST /api/agents).
    const existing = await prisma.agentProfile.findFirst({
      where: { agentKey: params.agentKey, ownerId: user.id },
      select: { id: true },
    });
    if (!existing) return notFound("Custom agent not found");
    await prisma.agentProfile.update({
      where: { id: existing.id },
      data: { promptDraft: prompt, promptLastSaved: new Date() },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "prompt_draft_saved",
      targetType: "agent",
      targetId: params.agentKey,
      summary: `${params.agentKey} prompt taslağı kaydedildi`,
      actorId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
