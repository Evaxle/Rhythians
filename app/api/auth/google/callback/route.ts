import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { recordReferral, REFERRAL_COOKIE_NAME } from "@/lib/referrals";
import { NEXT_COOKIE, STATE_COOKIE } from "@/app/api/auth/google/route";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleUser = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  locale?: string;
};

function cleanUsername(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_ ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 32);
  if (cleaned.length >= 3) return cleaned;
  return `user_${Math.random().toString(36).slice(2, 8)}`;
}

function baseProfileHandle(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return cleaned || `user-${Math.random().toString(36).slice(2, 8)}`;
}

async function uniqueProfileHandle(value: string) {
  const base = baseProfileHandle(value);
  let candidate = base;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!(await prisma.user.findUnique({ where: { profileHandle: candidate }, select: { id: true } }))) return candidate;
    candidate = `${base.slice(0, 34)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  throw new Error("Could not allocate a unique profile handle.");
}

function clearOAuthCookies(response: NextResponse) {
  for (const name of [STATE_COOKIE, NEXT_COOKIE]) {
    response.cookies.set({ name, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const savedState = cookieHeader.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1] ?? null;
  const savedNext = cookieHeader.match(new RegExp(`${NEXT_COOKIE}=([^;]+)`))?.[1] ?? "/";
  const next = decodeURIComponent(savedNext).startsWith("/") && !decodeURIComponent(savedNext).startsWith("//") ? decodeURIComponent(savedNext) : "/";

  if (!code || !state || !savedState || state !== decodeURIComponent(savedState)) {
    const response = NextResponse.redirect(new URL("/login?error=google_state", request.url));
    clearOAuthCookies(response);
    return response;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    const response = NextResponse.redirect(new URL("/login?error=google_config", request.url));
    clearOAuthCookies(response);
    return response;
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    if (!tokenResponse.ok) {
      const response = NextResponse.redirect(new URL("/login?error=google_token", request.url));
      clearOAuthCookies(response);
      return response;
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) throw new Error("Google did not return an access token.");
    const userResponse = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${tokenData.access_token}` }, cache: "no-store" });
    if (!userResponse.ok) {
      const response = NextResponse.redirect(new URL("/login?error=google_user", request.url));
      clearOAuthCookies(response);
      return response;
    }

    const googleUser = await userResponse.json() as GoogleUser;
    const email = googleUser.email?.trim().toLowerCase() ?? "";
    if (!email || googleUser.email_verified !== true) {
      const response = NextResponse.redirect(new URL("/login?error=google_email", request.url));
      clearOAuthCookies(response);
      return response;
    }

    let user = await prisma.user.findUnique({ where: { email } });
    const isNewUser = !user;
    if (!user) {
      const emailName = email.split("@")[0] ?? "user";
      const username = cleanUsername(googleUser.name || googleUser.given_name || emailName);
      const profileHandle = await uniqueProfileHandle(username || emailName);
      user = await prisma.user.create({
        data: {
          username,
          discriminator: "0000",
          displayName: googleUser.name?.trim().slice(0, 64) || null,
          locale: googleUser.locale?.slice(0, 16) || null,
          email,
          emailVerifiedAt: new Date(),
          profileHandle,
          onboardingCompleted: true,
        },
      });
    } else {
      if (user.isSuspended || (user.suspendedUntil && user.suspendedUntil > new Date())) {
        const response = NextResponse.redirect(new URL("/login?error=account_suspended", request.url));
        clearOAuthCookies(response);
        return response;
      }
      if (!user.emailVerifiedAt) user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    }

    if (isNewUser) {
      const referralCookie = cookieHeader.match(new RegExp(`${REFERRAL_COOKIE_NAME}=([^;]+)`))?.[1];
      if (referralCookie) {
        try { await recordReferral(decodeURIComponent(referralCookie), user.id); } catch (error) { console.error("Failed to record referral:", error); }
      }
    }

    const token = await createSession(user.id);
    const response = NextResponse.redirect(new URL(next, request.url));
    setSessionCookie(response, token);
    clearOAuthCookies(response);
    response.cookies.set({ name: REFERRAL_COOKIE_NAME, value: "", httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    const response = NextResponse.redirect(new URL("/login?error=google_failed", request.url));
    clearOAuthCookies(response);
    return response;
  }
}
