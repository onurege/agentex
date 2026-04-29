import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, forbidden, badRequest } from "@/lib/api-auth";
import { hashPassword, isStrongEnoughPassword } from "@/lib/password";
import { logAuditEvent } from "@/lib/server-audit";
import type { UserRole } from "@/lib/config/roles";

const VALID_ROLES: UserRole[] = ["user", "authorized_user", "super_admin"];

export async function GET() {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      active: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
      deletedAt: u.deletedAt?.toISOString() ?? null,
    })),
  );
}

export async function POST(req: Request) {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();

  let body: {
    email?: unknown;
    name?: unknown;
    password?: unknown;
    role?: unknown;
    active?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role : "user";
  const active = typeof body.active === "boolean" ? body.active : true;

  if (!email || !email.includes("@")) return badRequest("invalid_email");
  if (!VALID_ROLES.includes(role as UserRole)) return badRequest("invalid_role");
  if (!isStrongEnoughPassword(password)) return badRequest("weak_password");

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && !existing.deletedAt) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: name || null,
          passwordHash,
          role,
          active,
          deletedAt: null,
          emailVerified: null,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: name || null,
          passwordHash,
          role,
          active,
        },
      });

  await logAuditEvent({
    action: "user_created",
    targetType: "user",
    targetId: user.id,
    summary: `${user.email} kullanıcısı oluşturuldu`,
    module: "admin",
    severity: "warning",
    metadata: { role, active },
    actorId: caller.id,
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  });
}
