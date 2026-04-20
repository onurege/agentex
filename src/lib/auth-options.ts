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
// Current scope (commit 4): adapter + provider + session/redirect
// callbacks. Domain allowlist, initial super_admin promotion, and the
// custom error page land in commits 5 and 6.
// ============================================================

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

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
  },
  callbacks: {
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
};
