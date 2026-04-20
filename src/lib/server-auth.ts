// ============================================================
// Server-only auth helpers
// ============================================================
//
// Kept out of src/lib/config/roles.ts so that module can stay pure
// (client components import it for permission maps and types).
// Anything here pulls in authOptions → prisma → pg, which the browser
// bundle cannot resolve.
// ============================================================

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import {
  getPermissions,
  type UserPermissions,
  type UserRole,
} from "@/lib/config/roles";

export async function getServerUserRole(): Promise<UserRole> {
  const session = await getServerSession(authOptions);
  return session?.user?.role ?? "user";
}

/**
 * Enforces a permission from within a server component. Redirects:
 *   - No session (stale/invalid cookie) → "/" with callbackUrl set to the
 *     current URL so the user can re-login and return.
 *   - Session exists but lacks the permission → /auth/error?error=Forbidden.
 *
 * Call at the top of server layouts, e.g.:
 *   await requireServerPermission("canAccessPanel");
 */
export async function requireServerPermission(
  permission: keyof UserPermissions,
): Promise<void> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  if (!getPermissions(session.user.role)[permission]) {
    redirect("/auth/error?error=Forbidden");
  }
}
