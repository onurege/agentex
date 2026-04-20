import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
} from "@/lib/api-auth";
import type { UserRole } from "@/lib/config/roles";

const VALID_ROLES: UserRole[] = ["user", "authorized_user", "super_admin"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();
  if (caller.id === params.id) return badRequest("cannot_change_own_role");

  let body: { role?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  if (typeof body.role !== "string" || !VALID_ROLES.includes(body.role as UserRole)) {
    return badRequest("invalid_role");
  }
  const newRole = body.role as UserRole;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return notFound("user_not_found");

  // No-op guard: skip DB write + audit if role unchanged.
  if (target.role === newRole) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  // Transactional: count remaining super_admins AFTER the hypothetical
  // update and refuse to drop the last one. Count + update in a single
  // $transaction closes the race window where two concurrent demotions
  // could both pass their count check and leave zero super_admins.
  try {
    await prisma.$transaction(async (tx) => {
      if (target.role === "super_admin" && newRole !== "super_admin") {
        const remaining = await tx.user.count({
          where: { role: "super_admin", id: { not: params.id } },
        });
        if (remaining === 0) {
          throw new Error("LAST_SUPER_ADMIN");
        }
      }

      await tx.user.update({
        where: { id: params.id },
        data: { role: newRole },
      });

      await tx.auditLog.create({
        data: {
          action: "role_changed",
          targetType: "user",
          targetId: params.id,
          summary: `${target.email}: ${target.role} → ${newRole}`,
          actorId: caller.id,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "LAST_SUPER_ADMIN") {
      return NextResponse.json(
        { error: "last_super_admin" },
        { status: 400 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
