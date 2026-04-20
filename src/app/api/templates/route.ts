import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const templates = await prisma.boardTemplate.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      emoji: t.emoji,
      agentKeys: t.agentKeys,
      ownerId: t.ownerId,
    })),
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: { name?: string; description?: string; emoji?: string; agentKeys?: string[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!body.name || !Array.isArray(body.agentKeys)) {
    return badRequest("name and agentKeys required");
  }

  const template = await prisma.boardTemplate.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      emoji: body.emoji ?? null,
      agentKeys: body.agentKeys,
      ownerId: user.id,
    },
  });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    description: template.description,
    emoji: template.emoji,
    agentKeys: template.agentKeys,
    ownerId: template.ownerId,
  }, { status: 201 });
}
