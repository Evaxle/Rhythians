import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { GOOGLE_NEXT_COOKIE, GOOGLE_STATE_COOKIE } from "@/lib/google-auth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

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
  response.cookies.set({ name: GOOGLE_STATE_COOKIE, value: state, ...cookieOptions });
  response.cookies.set({ name: GOOGLE_NEXT_COOKIE, value: next, ...cookieOptions });
  return response;
}
