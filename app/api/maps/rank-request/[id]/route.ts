import { NextResponse } from "next/server";
import { getSessionUser, hasPermission, isOwner } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const map = await prisma.challengeMap.findUnique({ where: { id }, select: { id: true, title: true, status: true, isAutoImported: true } });
  if (!map || !map.isAutoImported || map.status !== "pending") return NextResponse.json({ error: "This map is not awaiting a ranking request." }, { status: 400 });

  const reviewers = await prisma.user.findMany({ include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
  const recipients = reviewers.filter((candidate) => hasPermission(candidate, "clips_moderate") || hasPermission(candidate, "admin_access") || isOwner(candidate));
  await prisma.$transaction(recipients.map((recipient) => prisma.notification.create({ data: { userId: recipient.id, type: "moderation", title: "Map ranking requested", message: `${user.displayName ?? user.username} requested that "${map.title}" be ranked.`, url: "/admin/maps" } })));
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const admin = await canAccessAdmin(user);
  if (!admin && !hasPermission(user, "clips_moderate") && !isOwner(user)) return NextResponse.json({ error: "Map reviewer or admin permission required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { ranked?: boolean } | null;
  if (typeof body?.ranked !== "boolean") return NextResponse.json({ error: "Ranked status is required." }, { status: 400 });
  const map = await prisma.challengeMap.findUnique({ where: { id }, select: { id: true, title: true, submittedById: true, isAutoImported: true } });
  if (!map || !map.isAutoImported) return NextResponse.json({ error: "Only synchronized Rhythia maps can be ranked here." }, { status: 400 });
  const updated = await prisma.challengeMap.update({ where: { id }, data: body.ranked ? { status: "approved", reviewedById: user.id, reviewedAt: new Date() } : { status: "pending", reviewedById: null, reviewedAt: null } });
  if (body.ranked) await prisma.notification.create({ data: { userId: map.submittedById, type: "map_approved", title: "Map ranked", message: `"${map.title}" is now ranked on Rhythians and can award RHP.`, url: `/maps/${map.id}` } });
  return NextResponse.json({ success: true, ranked: updated.status === "approved" });
}
