import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE = "rhythians_google_oauth_state";
const NEXT_COOKIE = "rhythians_google_oauth_next";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) return NextResponse.redirect(new URL("/login?error=google_config", request.url));

  const requestUrl = new URL(request.url);
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
  const state = randomBytes(32).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    include_granted_scopes: "true",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 10 * 60 };
  response.cookies.set({ name: STATE_COOKIE, value: state, ...cookieOptions });
  response.cookies.set({ name: NEXT_COOKIE, value: next, ...cookieOptions });
  return response;
}

export { STATE_COOKIE, NEXT_COOKIE };
