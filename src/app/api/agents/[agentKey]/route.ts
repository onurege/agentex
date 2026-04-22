import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, notFound } from "@/lib/api-auth";
import { profileToDTO } from "../mapping";

export async function GET(
  _req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const profile = await prisma.agentProfile.findFirst({
    where: {
      agentKey: params.agentKey,
      deletedAt: null,
      OR: [{ ownerId: null }, { ownerId: user.id }],
    },
    include: { currentVersion: true },
  });

  if (!profile) return notFound("Agent profile not found");

  return NextResponse.json(profileToDTO(profile));
}
