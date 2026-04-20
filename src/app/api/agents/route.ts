import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import type { AgentProfileDTO } from "@/lib/persistence/types";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const profiles = await prisma.agentProfile.findMany({
    where: { deletedAt: null },
    include: {
      currentVersion: true,
    },
    orderBy: { agentKey: "asc" },
  });

  const result: AgentProfileDTO[] = profiles.map((p) => ({
    agentKey: p.agentKey,
    cvDraft: p.cvDraft as AgentProfileDTO["cvDraft"],
    promptDraft: p.promptDraft as AgentProfileDTO["promptDraft"],
    cvLastSaved: p.cvLastSaved?.toISOString() ?? null,
    promptLastSaved: p.promptLastSaved?.toISOString() ?? null,
    currentVersion: p.currentVersion
      ? {
          id: p.currentVersion.id,
          version: p.currentVersion.version,
          cvSnapshot: p.currentVersion.cvSnapshot as AgentProfileDTO["cvDraft"],
          systemPrompt: p.currentVersion.systemPrompt,
          rolePrompt: p.currentVersion.rolePrompt,
          outputRules: p.currentVersion.outputRules,
          guardrails: p.currentVersion.guardrails,
          publishedAt: p.currentVersion.publishedAt.toISOString(),
        }
      : null,
  }));

  return NextResponse.json(result);
}
