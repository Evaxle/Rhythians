import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/security";

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
  const rate = checkRateLimit(request, "auth_login", 10, 15 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });
  const body = (await request.json().catch(() => null)) as { identifier?: unknown; password?: unknown; next?: unknown } | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const next = typeof body?.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : null;
  if (!identifier || !password) return NextResponse.json({ error: "Username or email and password are required." }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] } });
  if (!user || !user.passwordHash) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  if (!(await verifyPassword(password, user.passwordHash))) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  if (user.isSuspended) return NextResponse.json({ error: "This account has been suspended." }, { status: 403 });
  const token = await createSession(user.id);
  const response = NextResponse.json({ user: { id: user.id, username: user.username, profileHandle: user.profileHandle, onboardingCompleted: user.onboardingCompleted }, redirectTo: next ?? (user.onboardingCompleted ? "/" : "/onboarding") });
  setSessionCookie(response, token);
  return response;
}
