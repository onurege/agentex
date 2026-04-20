import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const url = req.nextUrl;
  const action = url.searchParams.get("action") ?? undefined;
  const targetType = url.searchParams.get("targetType") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  const events = await prisma.auditLog.findMany({
    where: {
      ...(action && { action }),
      ...(targetType && { targetType }),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId ?? "",
      summary: e.summary,
      actor: e.actorId ?? "system",
      timestamp: e.timestamp.toISOString(),
    })),
  );
}
