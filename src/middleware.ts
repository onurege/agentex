// ============================================================
// Auth Middleware — /app route entry guard
// ============================================================
//
// Middleware runs on the Edge runtime where Prisma (and therefore
// getServerSession) is unavailable, so we can't validate the session
// against the DB here. With NextAuth v4 database sessions the cookie
// holds an opaque session token, not a JWT, so getToken() also cannot
// decode it. The only check we can cheaply make is: is a session
// cookie present? If yes, let the request through; server components
// / API routes then run the authoritative DB-backed session check.
//
// Dev bypass has been removed: local dev now requires Google OAuth
// credentials just like production, so server-layout role guards stay
// consistent in every environment.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",            // dev / http
  "__Secure-next-auth.session-token",   // prod / https
];

export function middleware(request: NextRequest) {
  const hasSession = SESSION_COOKIE_NAMES.some(
    (name) => request.cookies.get(name)?.value,
  );

  if (!hasSession) {
    const url = new URL("/", request.url);
    url.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
