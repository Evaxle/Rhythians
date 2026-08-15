import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "rhythians_session";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.isSuspended) return null;
  return session.user;
}

export function isOwner(user: { discordId?: string | null } | null) {
  if (!user) return false;
  const ownerId = process.env.OWNER_DISCORD_ID;
  return Boolean(ownerId) && user.discordId === ownerId;
}

export function hasPermission(user: { roles: Array<any> } | null, permission: string) {
  if (!user) return false;
  const permissions = new Set(user.roles.flatMap((roleRecord: any) => roleRecord.role.permissions.map((rp: any) => rp.permission.name)));
  return permissions.has(permission);
}

export async function createSession(userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Number(process.env.SESSION_EXPIRES_DAYS ?? 30) * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Number(process.env.SESSION_EXPIRES_DAYS ?? 30) * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
}
