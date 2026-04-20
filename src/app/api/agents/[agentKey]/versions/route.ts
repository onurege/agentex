import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound } from "@/lib/api-auth";
import type { AgentVersionDTO } from "@/lib/persistence/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const profile = await prisma.agentProfile.findFirst({
    where: { agentKey: params.agentKey, deletedAt: null },
  });

  if (!profile) return notFound("Agent profile not found");

  const versions = await prisma.agentVersion.findMany({
    where: { profileId: profile.id },
    orderBy: { version: "desc" },
  });

  const result: AgentVersionDTO[] = versions.map((v) => ({
    id: v.id,
    version: v.version,
    cvSnapshot: v.cvSnapshot as AgentVersionDTO["cvSnapshot"],
    systemPrompt: v.systemPrompt,
    rolePrompt: v.rolePrompt,
    outputRules: v.outputRules,
    guardrails: v.guardrails,
    publishedAt: v.publishedAt.toISOString(),
  }));

  return NextResponse.json(result);
}
