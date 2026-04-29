import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const profile = await prisma.agentProfile.findFirst({
    where: { agentKey: params.agentKey, ownerId: user.id, deletedAt: null },
    include: { currentVersion: true },
  });

  if (!profile?.currentVersion) {
    return badRequest("No published version to rollback to");
  }

  const published = profile.currentVersion;
  await prisma.agentProfile.update({
    where: { id: profile.id },
    data: {
      promptDraft: {
        systemPrompt: published.systemPrompt ?? "",
        rolePrompt: published.rolePrompt ?? "",
        outputRules: published.outputRules ?? "",
        guardrails: published.guardrails ?? "",
      },
      promptLastSaved: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "prompt_rollback",
      targetType: "agent",
      targetId: params.agentKey,
      summary: `${params.agentKey} prompt v${published.version}'e geri alındı`,
      module: "control_room",
      severity: "warning",
      metadata: { agentKey: params.agentKey, version: published.version },
      actorId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
