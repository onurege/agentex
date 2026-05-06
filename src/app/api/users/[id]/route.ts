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
import { hashPassword, isStrongEnoughPassword } from "@/lib/password";

const VALID_ROLES: UserRole[] = ["user", "authorized_user", "super_admin"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();
  if (caller.id === params.id) return badRequest("cannot_change_own_role");

  let body: {
    role?: unknown;
    active?: unknown;
    name?: unknown;
    password?: unknown;
    groupId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const hasRole = body.role !== undefined;
  const hasActive = body.active !== undefined;
  const hasName = body.name !== undefined;
  const hasPassword = body.password !== undefined;
  const hasGroup = body.groupId !== undefined;

  if (hasRole && (typeof body.role !== "string" || !VALID_ROLES.includes(body.role as UserRole))) {
    return badRequest("invalid_role");
  }
  if (hasActive && typeof body.active !== "boolean") return badRequest("invalid_active");
  if (hasName && typeof body.name !== "string") return badRequest("invalid_name");
  if (hasPassword && (typeof body.password !== "string" || !isStrongEnoughPassword(body.password))) {
    return badRequest("weak_password");
  }
  if (hasGroup && body.groupId !== null && typeof body.groupId !== "string") {
    return badRequest("invalid_group");
  }
  if (!hasRole && !hasActive && !hasName && !hasPassword && !hasGroup) {
    return badRequest("empty_update");
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return notFound("user_not_found");
  if (target.deletedAt) return notFound("user_not_found");

  const newRole = hasRole ? (body.role as UserRole) : (target.role as UserRole);
  const newActive = hasActive ? Boolean(body.active) : target.active;
  const newName = hasName ? (body.name as string).trim() || null : target.name;
  const newGroupId = hasGroup
    ? (body.groupId === null ? null : (body.groupId as string))
    : target.groupId;

  if (hasGroup && newGroupId !== null) {
    const group = await prisma.group.findUnique({
      where: { id: newGroupId },
      select: { id: true },
    });
    if (!group) return notFound("group_not_found");
  }

  // No-op short-circuit: detect via the request *intent* (hasPassword) rather
  // than comparing hashes. Each hashPassword() call yields a fresh salt, so
  // hash equality is never true even when re-submitting the same plaintext —
  // checking it would force us to spend ~200ms in pbkdf2 just to throw the
  // result away.
  if (
    !hasPassword &&
    target.role === newRole &&
    target.active === newActive &&
    target.name === newName &&
    target.groupId === newGroupId
  ) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const newPasswordHash =
    hasPassword && typeof body.password === "string"
      ? await hashPassword(body.password)
      : target.passwordHash;

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
      if (target.role === "super_admin" && !newActive) {
        const remaining = await tx.user.count({
          where: {
            role: "super_admin",
            active: true,
            deletedAt: null,
            id: { not: params.id },
          },
        });
        if (remaining === 0) {
          throw new Error("LAST_SUPER_ADMIN");
        }
      }

      await tx.user.update({
        where: { id: params.id },
        data: {
          role: newRole,
          active: newActive,
          name: newName,
          passwordHash: newPasswordHash,
          groupId: newGroupId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: hasGroup && !hasRole && !hasActive && !hasName && !hasPassword
            ? "user_group_changed"
            : hasRole && !hasActive && !hasName && !hasPassword && !hasGroup
              ? "role_changed"
              : "user_updated",
          targetType: "user",
          targetId: params.id,
          summary: `${target.email} kullanıcısı güncellendi`,
          module: "admin",
          severity: "warning",
          metadata: {
            previousRole: target.role,
            newRole,
            previousActive: target.active,
            newActive,
            nameChanged: target.name !== newName,
            passwordChanged: hasPassword,
            previousGroupId: target.groupId,
            newGroupId,
          },
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();
  if (caller.id === params.id) return badRequest("cannot_delete_self");

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target || target.deletedAt) return notFound("user_not_found");

  try {
    await prisma.$transaction(async (tx) => {
      if (target.role === "super_admin") {
        const remaining = await tx.user.count({
          where: {
            role: "super_admin",
            active: true,
            deletedAt: null,
            id: { not: params.id },
          },
        });
        if (remaining === 0) throw new Error("LAST_SUPER_ADMIN");
      }

      await tx.user.update({
        where: { id: params.id },
        data: {
          active: false,
          deletedAt: new Date(),
          passwordHash: null,
        },
      });

      // Revocation under JWT strategy: the jwt callback re-fetches the user
      // on every request and gates `token.active` on `dbUser.active && !deletedAt`.
      // Once we flip those flags here, the next request from the deleted user
      // is rejected — no Session-row deletion is needed (and would be a no-op
      // since JWT mode does not write to the Session table).

      await tx.auditLog.create({
        data: {
          action: "user_deleted",
          targetType: "user",
          targetId: params.id,
          summary: `${target.email} kullanıcısı silindi`,
          module: "admin",
          severity: "critical",
          metadata: { role: target.role },
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
