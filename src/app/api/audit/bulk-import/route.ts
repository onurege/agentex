import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";
import type { AuditEventDTO } from "@/lib/persistence/types";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: { events?: AuditEventDTO[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!Array.isArray(body.events)) {
    return badRequest("Expected { events: [...] }");
  }

  let imported = 0;
  let skipped = 0;

  for (const event of body.events) {
    const existing = await prisma.auditLog.findUnique({ where: { id: event.id } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.auditLog.create({
      data: {
        id: event.id,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId || null,
        summary: event.summary,
        actorId: user.id,
        timestamp: new Date(event.timestamp),
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
