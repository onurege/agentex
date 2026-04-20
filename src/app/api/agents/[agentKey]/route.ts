import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound } from "@/lib/api-auth";
import type { AgentProfileDTO } from "@/lib/persistence/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const profile = await prisma.agentProfile.findFirst({
    where: { agentKey: params.agentKey, deletedAt: null },
    include: { currentVersion: true },
  });

  if (!profile) return notFound("Agent profile not found");

  const result: AgentProfileDTO = {
    agentKey: profile.agentKey,
    cvDraft: profile.cvDraft as AgentProfileDTO["cvDraft"],
    promptDraft: profile.promptDraft as AgentProfileDTO["promptDraft"],
    cvLastSaved: profile.cvLastSaved?.toISOString() ?? null,
    promptLastSaved: profile.promptLastSaved?.toISOString() ?? null,
    currentVersion: profile.currentVersion
      ? {
          id: profile.currentVersion.id,
          version: profile.currentVersion.version,
          cvSnapshot: profile.currentVersion.cvSnapshot as AgentProfileDTO["cvDraft"],
          systemPrompt: profile.currentVersion.systemPrompt,
          rolePrompt: profile.currentVersion.rolePrompt,
          outputRules: profile.currentVersion.outputRules,
          guardrails: profile.currentVersion.guardrails,
          publishedAt: profile.currentVersion.publishedAt.toISOString(),
        }
      : null,
  };

  return NextResponse.json(result);
}
