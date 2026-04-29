// ============================================================
// NextAuth module augmentation
// ============================================================
//
// Extends the Session.user and User types so TypeScript sees the fields
// we inject in the session callback (id, role, active). Picked up
// automatically by tsconfig's "**/*.ts" include glob.
// ============================================================

import type { DefaultSession, DefaultUser } from "next-auth";

export type UserRole = "user" | "authorized_user" | "super_admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      active: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: UserRole;
    active: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    active?: boolean;
  }
}
