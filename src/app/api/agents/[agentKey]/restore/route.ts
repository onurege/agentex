// ============================================================
// POST /api/agents/[agentKey]/restore
// ============================================================
//
// Clears archivedAt on a user-created custom agent.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  forbidden,
  getAuthUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const profile = await prisma.agentProfile.findFirst({
    where: { agentKey: params.agentKey, deletedAt: null },
  });
  if (!profile) return notFound("Agent profile not found");
  if (!profile.isUserCreated) return badRequest("system_agent_not_restorable");
  if (profile.ownerId !== user.id && user.role !== "super_admin")
    return forbidden();
  if (!profile.archivedAt) {
    return NextResponse.json({ archived: false });
  }

  await prisma.agentProfile.update({
    where: { id: profile.id },
    data: { archivedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      action: "agent_restored",
      targetType: "agent",
      targetId: params.agentKey,
      summary: `Özel ajan "${profile.displayName ?? params.agentKey}" arşivden çıkarıldı`,
      actorId: user.id,
    },
  });

  return NextResponse.json({ archived: false });
}
