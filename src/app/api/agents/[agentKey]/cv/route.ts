import { NextRequest, NextResponse } from "next/server";
import { BOARDROOM_AGENTS } from "@/lib/boardroom-agents";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  getAuthUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";

// Built-in system agents for which a user-owned "tweak" row is
// created on first CV edit. A slug outside this set must already
// exist as a custom agent row (POST /api/agents) — the upsert-
// anywhere path was what stamped rows with isUserCreated=false,
// orphaning them from the panel's hydrator filter.
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

  let cv: import("@prisma/client").Prisma.InputJsonValue;
  try {
    cv = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (SYSTEM_KEYS.has(params.agentKey)) {
    // System agent tweak — upsert a user-owned row.
    await prisma.agentProfile.upsert({
      where: {
        agentKey_ownerId: { agentKey: params.agentKey, ownerId: user.id },
      },
      create: {
        agentKey: params.agentKey,
        ownerId: user.id,
        cvDraft: cv,
        cvLastSaved: new Date(),
      },
      update: {
        cvDraft: cv,
        cvLastSaved: new Date(),
      },
    });
  } else {
    // Custom agent — row must already exist from POST /api/agents.
    // Refusing to create here prevents orphan rows with null
    // identity fields + isUserCreated=false.
    const existing = await prisma.agentProfile.findFirst({
      where: { agentKey: params.agentKey, ownerId: user.id },
      select: { id: true },
    });
    if (!existing) return notFound("Custom agent not found");
    await prisma.agentProfile.update({
      where: { id: existing.id },
      data: { cvDraft: cv, cvLastSaved: new Date() },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "cv_draft_saved",
      targetType: "agent",
      targetId: params.agentKey,
      summary: `${params.agentKey} CV taslağı kaydedildi`,
      module: "control_room",
      severity: "info",
      metadata: { agentKey: params.agentKey },
      actorId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
