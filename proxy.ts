import { NextResponse, type NextRequest } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https:",
    "font-src 'self' data: https:",
  ].join("; "),
};

if (process.env.NODE_ENV === "production") {
  SECURITY_HEADERS["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
}

const STATE_CHANGING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block cross-origin state-changing requests to API routes (CSRF defense-in-depth).
  // SameSite=Lax on the session cookie already blocks the cookie cross-site; this rejects
  // forged requests outright. Requests without an Origin header (server-side, cron) are allowed.
  if (pathname.startsWith("/api/") && STATE_CHANGING.has(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (origin && host) {
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return new NextResponse("Bad Request", { status: 400 });
      }
      const allowedHosts = new Set([
        host,
        process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : "",
      ]);
      if (!allowedHosts.has(originHost)) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|rhythians.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov)$).*)",
  ],
};
