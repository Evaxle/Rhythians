import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit, rateLimit } from "@/lib/security";
import { createSecurityCode, hashSecurityCode, MFA_COOKIE_NAME } from "@/lib/email-auth";
import { sendSecurityCode } from "@/lib/email";

const DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const SCOPE = "identify email guilds guilds.members.read";

export async function GET() {
  if (!CLIENT_ID || !REDIRECT_URI) return NextResponse.json({ error: "Discord OAuth not configured" }, { status: 500 });
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: "code", scope: SCOPE, prompt: "consent" });
  return NextResponse.redirect(`${DISCORD_AUTH_URL}?${params.toString()}`);
}

export async function POST(request: Request) {
  const ipRate = checkRateLimit(request, "auth_login", 10, 15 * 60 * 1000);
  if (!ipRate.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSec) } });

  const body = await request.json().catch(() => null) as { identifier?: unknown; password?: unknown; next?: unknown } | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const next = typeof body?.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : null;
  if (!identifier || !password) return NextResponse.json({ error: "Username or email and password are required." }, { status: 400 });

  const identityKey = identifier.toLowerCase().slice(0, 254);
  const identityRate = rateLimit(`auth_login_identity:${identityKey}`, 5, 15 * 60 * 1000);
  if (!identityRate.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(identityRate.retryAfterSec) } });

  const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] } });
  if (!user || !user.passwordHash) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  if (!(await verifyPassword(password, user.passwordHash))) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  if (user.isSuspended) return NextResponse.json({ error: "This account has been suspended." }, { status: 403 });

  const redirectTo = next ?? (user.onboardingCompleted ? "/" : "/onboarding");
  if (user.emailTwoFactorEnabled && user.emailVerifiedAt && user.email) {
    await prisma.emailMfaChallenge.deleteMany({ where: { userId: user.id, usedAt: null } });
    const code = createSecurityCode();
    const challenge = await prisma.emailMfaChallenge.create({
      data: {
        userId: user.id,
        codeHash: hashSecurityCode(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        redirectTo,
      },
    });

    try {
      await sendSecurityCode(user.email, code, "Your Rhythians sign-in code", "Confirm your Rhythians sign-in");
    } catch {
      await prisma.emailMfaChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      return NextResponse.json({ error: "We could not send your sign-in code. Please try again later." }, { status: 503 });
    }

    const response = NextResponse.json({ requiresTwoFactor: true, redirectTo: "/verify-2fa" });
    response.cookies.set({ name: MFA_COOKIE_NAME, value: challenge.id, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 10 * 60 });
    return response;
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({ user: { id: user.id, username: user.username, profileHandle: user.profileHandle, onboardingCompleted: user.onboardingCompleted }, redirectTo });
  setSessionCookie(response, token);
  return response;
}
