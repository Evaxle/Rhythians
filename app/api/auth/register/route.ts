import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/security";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_ ]{3,32}$/;

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "auth_register", 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many accounts created from this address. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    email?: unknown;
    password?: unknown;
  } | null;

  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-32 characters using letters, numbers, underscores, or spaces." },
      { status: 400 }
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const baseHandle = username.toLowerCase().replace(/\s+/g, "-");
  let profileHandle = baseHandle;
  let attempts = 0;
  while (await prisma.user.findUnique({ where: { profileHandle } })) {
    attempts++;
    if (attempts > 5) return NextResponse.json({ error: "Could not create a unique handle. Try a different username." }, { status: 409 });
    profileHandle = `${baseHandle}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const user = await prisma.user.create({
    data: {
      username,
      discriminator: "0000",
      email,
      passwordHash: await hashPassword(password),
      profileHandle,
      onboardingCompleted: false,
    },
  });

  const token = await createSession(user.id);
  const response = NextResponse.json({
    user: { id: user.id, username: user.username, profileHandle: user.profileHandle, onboardingCompleted: user.onboardingCompleted },
    redirectTo: "/onboarding",
  });
  setSessionCookie(response, token);

  return response;
}
