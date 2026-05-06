import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import type { UserRole } from "@/lib/config/roles";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
  image?: string | null;
  groupId: string | null;
}

export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  if (!session.user.active) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    name: session.user.name,
    image: session.user.image,
    groupId: session.user.groupId ?? null,
  };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Read-access policy for a BoardRun. The viewer can read the run if
 * they own it, share its group (groupId non-null and equal), or are
 * super_admin. Same-group access is read-only — write paths still
 * require ownership.
 */
export function canReadRun(
  viewer: SessionUser,
  run: { userId: string; groupId: string | null },
): boolean {
  if (run.userId === viewer.id) return true;
  if (viewer.role === "super_admin") return true;
  if (run.groupId !== null && run.groupId === viewer.groupId) return true;
  return false;
}
