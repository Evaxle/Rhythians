import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { warnUser } from "@/lib/user-moderation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function PATCH(request: Request, { params }: Props) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (action === "ban") {
    await prisma.user.update({ where: { id }, data: { isSuspended: true, suspendedUntil: null } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.notification.create({
      data: {
        userId: id,
        type: "moderation",
        title: "You have been banned",
        message: typeof body?.reason === "string" ? body.reason.slice(0, 500) : "Your account has been banned from Rhythians.",
        url: "/login",
      },
    });
    await prisma.moderationAction.create({
      data: { actorId: admin.id, action: "user_banned", targetType: "user", targetId: id, metadata: { reason: body?.reason ?? null } },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "suspend") {
    const days = Math.min(Math.max(Number(body?.days) || 1, 1), 365);
    const until = daysFromNow(days);
    await prisma.user.update({ where: { id }, data: { isSuspended: true, suspendedUntil: until } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.notification.create({
      data: {
        userId: id,
        type: "moderation",
        title: "Your account has been suspended",
        message: `Your account is suspended until ${until.toLocaleDateString()}.${typeof body?.reason === "string" ? ` Reason: ${body.reason.slice(0, 500)}` : ""}`,
        url: "/login",
      },
    });
    await prisma.moderationAction.create({
      data: { actorId: admin.id, action: "user_suspended", targetType: "user", targetId: id, metadata: { until: until.toISOString(), reason: body?.reason ?? null } },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "unsuspend" || action === "unban") {
    await prisma.user.update({ where: { id }, data: { isSuspended: false, suspendedUntil: null } });
    await prisma.notification.create({
      data: {
        userId: id,
        type: "moderation",
        title: "Your account has been reinstated",
        message: "You can sign in again.",
        url: "/",
      },
    });
    await prisma.moderationAction.create({
      data: { actorId: admin.id, action: "user_unbanned", targetType: "user", targetId: id, metadata: {} },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mute") {
    const hours = Math.min(Math.max(Number(body?.hours) || 1, 1), 24 * 365);
    const until = hoursFromNow(hours);
    await prisma.user.update({ where: { id }, data: { mutedUntil: until } });
    await prisma.notification.create({
      data: {
        userId: id,
        type: "moderation",
        title: "You have been muted",
        message: `You cannot send messages or comments until ${until.toLocaleString()}.${typeof body?.reason === "string" ? ` Reason: ${body.reason.slice(0, 500)}` : ""}`,
        url: "/notifications",
      },
    });
    await prisma.moderationAction.create({
      data: { actorId: admin.id, action: "user_muted", targetType: "user", targetId: id, metadata: { until: until.toISOString(), reason: body?.reason ?? null } },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "unmute") {
    await prisma.user.update({ where: { id }, data: { mutedUntil: null } });
    await prisma.notification.create({
      data: {
        userId: id,
        type: "moderation",
        title: "You have been unmuted",
        message: "You can send messages and comments again.",
        url: "/",
      },
    });
    await prisma.moderationAction.create({
      data: { actorId: admin.id, action: "user_unmuted", targetType: "user", targetId: id, metadata: {} },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "warn") {
    if (isOwner(target)) {
      return NextResponse.json({ error: "You can't warn the site owner." }, { status: 400 });
    }
    const reason = typeof body?.reason === "string" ? body.reason : "";
    const result = await warnUser(admin.id, id, reason);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}