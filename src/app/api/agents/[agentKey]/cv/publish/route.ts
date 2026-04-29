import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";
import type { AgentVersionDTO } from "@/lib/persistence/types";

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

    if (!profile || !profile.cvDraft) {
      return null;
    }

    // Race-condition-safe: MAX(version) + 1 inside transaction
    const maxVersion = await tx.agentVersion.aggregate({
      where: { profileId: profile.id },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    // Get current prompt from latest version (if any) to preserve in new version
    const currentVersion = profile.currentVersionId
      ? await tx.agentVersion.findUnique({ where: { id: profile.currentVersionId } })
      : null;

    const version = await tx.agentVersion.create({
      data: {
        profileId: profile.id,
        version: nextVersion,
        cvSnapshot: profile.cvDraft,
        systemPrompt: currentVersion?.systemPrompt ?? null,
        rolePrompt: currentVersion?.rolePrompt ?? null,
        outputRules: currentVersion?.outputRules ?? null,
        guardrails: currentVersion?.guardrails ?? null,
      },
    });

    await tx.agentProfile.update({
      where: { id: profile.id },
      data: { currentVersionId: version.id },
    });

    await tx.auditLog.create({
      data: {
        action: "cv_published",
        targetType: "agent",
        targetId: params.agentKey,
        summary: `${params.agentKey} CV v${nextVersion} yayınlandı`,
        module: "control_room",
        severity: "info",
        metadata: { agentKey: params.agentKey, version: nextVersion },
        actorId: user.id,
      },
    });

    return version;
  });

  if (!result) {
    return badRequest("No CV draft to publish");
  }

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
