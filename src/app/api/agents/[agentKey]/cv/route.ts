import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";

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

  await prisma.auditLog.create({
    data: {
      action: "cv_draft_saved",
      targetType: "agent",
      targetId: params.agentKey,
      summary: `${params.agentKey} CV taslağı kaydedildi`,
      actorId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
