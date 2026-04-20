// ============================================================
// NextAuth Options
// ============================================================
//
// Shared config used by the /api/auth/[...nextauth] route handler and
// by server components / API routes calling getServerSession.
//
// Session strategy: "database" — session tokens live in the Session
// table, not in a signed JWT. Trade-off: cheap revocation and fresh
// role lookups at the cost of a DB round-trip per getServerSession.
//
// Access policy:
// - signIn callback rejects anything outside @univera.com.tr. Rejected
//   logins redirect to /auth/error?error=AccessDenied (commit 6).
// - events.signIn promotes INITIAL_SUPER_ADMIN_EMAIL on first login.
//   Idempotent: skipped once the target user already holds super_admin,
//   and a no-op when the env var is unset. Placed in `events` (not
//   `callbacks.signIn`) so it fires AFTER the adapter creates the User
//   row; otherwise the prisma.user.update would not find a target.
// ============================================================

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const ALLOWED_DOMAIN = "univera.com.tr";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: { scope: "openid email profile", prompt: "select_account" },
      },
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user }) {
      const email = (user.email ?? "").toLowerCase();
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return false;
      return true;
    },
    async session({ session, user }) {
      // DB strategy: `user` is the full User row from Prisma.
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role as "user" | "authorized_user" | "super_admin";
        session.user.active = user.active;
        // user.active check will be enforced here when the future
        // disable-user feature ships; for now it is schema-only.
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Honor ?callbackUrl= set by middleware: if the requested URL is
      // within the app, return it so the user lands where they started.
      if (url.startsWith("/app")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/app`;
    },
  },
  events: {
    async signIn({ user }) {
      const initialEmail = process.env.INITIAL_SUPER_ADMIN_EMAIL?.toLowerCase();
      if (!initialEmail) return;
      if (user.email?.toLowerCase() !== initialEmail) return;
      if (user.role === "super_admin") return; // idempotent
      await prisma.user.update({
        where: { email: initialEmail },
        data: { role: "super_admin" },
      });
    },
  },
};
