import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, forbidden, badRequest } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/server-audit";

// All endpoints in this module are super_admin only.

export async function GET() {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();

  const groups = await prisma.group.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt.toISOString(),
      memberCount: g._count.users,
    })),
  );
}

export async function POST(req: Request) {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0 || name.length > 80) return badRequest("invalid_name");

  const existing = await prisma.group.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "name_taken" }, { status: 409 });
  }

  const group = await prisma.group.create({ data: { name } });

  await logAuditEvent({
    action: "group_created",
    targetType: "group",
    targetId: group.id,
    summary: `"${name}" grubu oluşturuldu`,
    module: "admin",
    severity: "warning",
    metadata: { name },
    actorId: caller.id,
  });

  return NextResponse.json({
    id: group.id,
    name: group.name,
    createdAt: group.createdAt.toISOString(),
    memberCount: 0,
  });
}
