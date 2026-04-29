import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";
import type { AgentVersionDTO, AgentProfileDTO } from "@/lib/persistence/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.agentProfile.findFirst({
      where: { agentKey: params.agentKey, ownerId: user.id, deletedAt: null },
    });

    if (!profile || !profile.promptDraft) return null;

    const promptDraft = profile.promptDraft as unknown as NonNullable<AgentProfileDTO["promptDraft"]>;

    const maxVersion = await tx.agentVersion.aggregate({
      where: { profileId: profile.id },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    const currentVersion = profile.currentVersionId
      ? await tx.agentVersion.findUnique({ where: { id: profile.currentVersionId } })
      : null;

    const version = await tx.agentVersion.create({
      data: {
        profileId: profile.id,
        version: nextVersion,
        cvSnapshot: (currentVersion?.cvSnapshot as import("@prisma/client").Prisma.InputJsonValue) ?? undefined,
        systemPrompt: promptDraft.systemPrompt,
        rolePrompt: promptDraft.rolePrompt,
        outputRules: promptDraft.outputRules,
        guardrails: promptDraft.guardrails,
      },
    });

    await tx.agentProfile.update({
      where: { id: profile.id },
      data: { currentVersionId: version.id },
    });

    await tx.auditLog.create({
      data: {
        action: "prompt_published",
        targetType: "agent",
        targetId: params.agentKey,
        summary: `${params.agentKey} prompt v${nextVersion} yayınlandı`,
        module: "control_room",
        severity: "info",
        metadata: { agentKey: params.agentKey, version: nextVersion },
        actorId: user.id,
      },
    });

    return version;
  });

  if (!result) return badRequest("No prompt draft to publish");

  const dto: AgentVersionDTO = {
    id: result.id,
    version: result.version,
    cvSnapshot: result.cvSnapshot as AgentVersionDTO["cvSnapshot"],
    systemPrompt: result.systemPrompt,
    rolePrompt: result.rolePrompt,
    outputRules: result.outputRules,
    guardrails: result.guardrails,
    publishedAt: result.publishedAt.toISOString(),
  };

  return NextResponse.json(dto, { status: 201 });
}
