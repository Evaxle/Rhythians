import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRhythKitInstallation } from "@/lib/rhythkit-api";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "rhythians_session";

async function userFromRhythKit(requestHeaders: Headers) {
  const authorization = requestHeaders.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const installation = await getRhythKitInstallation(new Request("https://rhythians.local", { headers: { authorization: `Bearer ${token}` } }));
  if (!installation) return null;
  return prisma.user.findUnique({
    where: { id: installation.userId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    const bearerUser = await userFromRhythKit(await headers());
    if (!bearerUser) return null;
    if (!isOwner(bearerUser)) {
      if (bearerUser.isSuspended) return null;
      if (bearerUser.suspendedUntil && bearerUser.suspendedUntil > new Date()) return null;
    }
    return bearerUser;
  }
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (!isOwner(session.user)) {
    if (session.user.isSuspended) return null;
    if (session.user.suspendedUntil && session.user.suspendedUntil > new Date()) return null;
  }
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
  const token = randomBytes(32).toString("hex");
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