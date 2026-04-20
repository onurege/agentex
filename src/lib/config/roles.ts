// ============================================================
// User Roles & Permissions
// ============================================================
//
// Three-tier role system for AI Boardroom:
//   user             — default, stage experience only
//   authorized_user  — can access Control Room (Panel)
//   super_admin      — full access including Users & Audit Log
//
// Role source (from Faz 2 onward):
//   - Persisted on User.role in Postgres.
//   - Injected onto session.user.role by the NextAuth session callback.
//   - Server components: getServerSession(authOptions) → session.user.role
//   - Client components: useSession()?.data?.user?.role
//   - API routes: getAuthUser() → user.role
//
// Env-based allowlists (NEXT_PUBLIC_SUPER_ADMINS, NEXT_PUBLIC_AUTHORIZED_USERS)
// are gone. INITIAL_SUPER_ADMIN_EMAIL bootstraps the first super_admin on
// first login (see src/lib/auth-options.ts events.signIn).
//
// This module stays pure (types + PERMISSION_MAP) so client bundles can
// import it without pulling in Prisma / pg via authOptions.
// ============================================================

export type UserRole = "user" | "authorized_user" | "super_admin";

export interface UserPermissions {
  canAccessPanel: boolean;
  canManageOwnAgents: boolean;
  canManageOwnPrompts: boolean;
  canViewUsers: boolean;
  canViewAudit: boolean;
}

const PERMISSION_MAP: Record<UserRole, UserPermissions> = {
  user: {
    canAccessPanel: false,
    canManageOwnAgents: false,
    canManageOwnPrompts: false,
    canViewUsers: false,
    canViewAudit: false,
  },
  authorized_user: {
    canAccessPanel: true,
    canManageOwnAgents: true,
    canManageOwnPrompts: true,
    canViewUsers: false,
    canViewAudit: false,
  },
  super_admin: {
    canAccessPanel: true,
    canManageOwnAgents: true,
    canManageOwnPrompts: true,
    canViewUsers: true,
    canViewAudit: true,
  },
};

export function getPermissions(role: UserRole): UserPermissions {
  return PERMISSION_MAP[role];
}
