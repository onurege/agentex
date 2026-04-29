// ============================================================
// POST /api/agents/[agentKey]/archive
// ============================================================
//
// Soft-archives a user-created custom agent. System agents
// (ownerId null, isUserCreated false) are rejected.
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
  if (!profile.isUserCreated) return badRequest("system_agent_not_archivable");
  if (profile.ownerId !== user.id && user.role !== "super_admin")
    return forbidden();
  if (profile.archivedAt) {
    // Already archived — idempotent OK.
    return NextResponse.json({ archived: true });
  }

  await prisma.agentProfile.update({
    where: { id: profile.id },
    data: { archivedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      action: "agent_archived",
      targetType: "agent",
      targetId: params.agentKey,
      summary: `Özel ajan "${profile.displayName ?? params.agentKey}" arşivlendi`,
      module: "control_room",
      severity: "warning",
      metadata: { agentKey: params.agentKey },
      actorId: user.id,
    },
  });

  return NextResponse.json({ archived: true });
}
