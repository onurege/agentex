// ============================================================
// Auth Middleware — /app route entry guard
// ============================================================
//
// Credentials auth uses NextAuth JWT sessions, so the middleware can
// validate the token at the edge before allowing /app access.
// ============================================================

import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // In production NextAuth issues `__Secure-next-auth.session-token`; in dev
  // the cookie has no prefix. getToken auto-detects from request URL but
  // being explicit avoids edge cases behind reverse proxies that strip the
  // protocol.
  const isProd = process.env.NODE_ENV === "production";
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isProd,
    cookieName: isProd
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token",
  });

  if (!token || token.active === false) {
    const url = new URL("/", request.url);
    url.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
