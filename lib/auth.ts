import { cookies } from "next/headers";
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
  return session.user;
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
