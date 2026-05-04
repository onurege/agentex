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
  // Cookie prefix follows NEXTAUTH_URL protocol, not NODE_ENV. HTTPS deploys
  // get `__Secure-next-auth.session-token`; HTTP deploys (internal reverse
  // proxy on private network) stay on the unprefixed cookie since browsers
  // refuse to set `__Secure-` cookies over HTTP.
  const useSecure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecure,
    cookieName: useSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token",
  });

  if (!token || token.active === false) {
    const url = new URL("/", request.url);
    const callbackPath = request.nextUrl.pathname + (request.nextUrl.search || "");
    url.searchParams.set("callbackUrl", callbackPath);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
