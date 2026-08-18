import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { clearSessionCookie } from "@/lib/auth";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "rhythians_session";

async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
}

export async function GET(request: Request) {
  await destroySession();
  const response = NextResponse.redirect(new URL("/", request.url));
  clearSessionCookie(response);
  return response;
}

export async function POST(request: Request) {
  await destroySession();
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
