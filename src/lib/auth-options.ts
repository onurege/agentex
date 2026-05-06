// ============================================================
// NextAuth Options — Credentials Auth
// ============================================================
//
// Google OAuth is intentionally disabled. Users are created and
// authorized by super admins from Control Room → Users.
//
// Bootstrap path:
// - If INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD are set,
//   that first login creates/updates the matching super_admin user.
// ============================================================

import { timingSafeEqual } from "crypto";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Bootstrap path runs ONCE. Once the super admin row has a passwordHash,
// the env-provided password must not overwrite a panel-rotated password —
// otherwise rotating credentials in the UI silently reverts on next login.
async function bootstrapInitialAdmin(email: string, password: string) {
  const initialEmail = process.env.INITIAL_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const initialPassword = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

  if (!initialEmail || !initialPassword) return null;
  if (email !== initialEmail) return null;
  if (!constantTimeEquals(password, initialPassword)) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return null;

  const passwordHash = await hashPassword(password);
  if (existing) {
    return prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        role: "super_admin",
        active: true,
        deletedAt: null,
      },
    });
  }
  return prisma.user.create({
    data: {
      email,
      name: "Super Admin",
      passwordHash,
      role: "super_admin",
      active: true,
    },
  });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email ve Şifre",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const bootstrapUser = await bootstrapInitialAdmin(email, password);
        const user =
          bootstrapUser ??
          (await prisma.user.findUnique({
            where: { email },
          }));

        if (!user || !user.active || user.deletedAt) return null;
        const passwordOk = await verifyPassword(password, user.passwordHash);
        if (!passwordOk) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as "user" | "authorized_user" | "super_admin",
          active: user.active,
        };
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            active: true,
            deletedAt: true,
            groupId: true,
          },
        });

        if (dbUser) {
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.role = dbUser.role as "user" | "authorized_user" | "super_admin";
          token.active = dbUser.active && !dbUser.deletedAt;
          token.groupId = dbUser.groupId ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = token.email ?? "";
        session.user.name = token.name ?? null;
        session.user.image = token.picture ?? null;
        session.user.role = (token.role ?? "user") as "user" | "authorized_user" | "super_admin";
        session.user.active = Boolean(token.active);
        session.user.groupId = (token.groupId as string | null | undefined) ?? null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/app")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/app`;
    },
  },
};
