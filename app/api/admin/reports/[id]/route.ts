import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(admin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    message?: unknown;
  } | null;

  const action = body?.action;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";

  if (!["warn", "ban", "resolve", "dismiss"].includes(action as string)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  let targetUser = null;
  if (report.targetType === "user") {
    targetUser = await prisma.user.findUnique({ where: { id: report.targetId } });
  } else {
    const clip = await prisma.clip.findUnique({ where: { id: report.targetId }, select: { uploaderId: true } });
    if (clip) targetUser = await prisma.user.findUnique({ where: { id: clip.uploaderId } });
  }

  const now = new Date();

  if (action === "warn") {
    if (!targetUser) return NextResponse.json({ error: "Target user not found." }, { status: 404 });
    if (!message) return NextResponse.json({ error: "A warning message is required." }, { status: 400 });
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: "moderation",
        title: "You have received a warning",
        message,
        url: "/notifications",
      },
    });
    await prisma.moderationAction.create({
      data: {
        actorId: admin.id,
        action: "user_warned",
        targetType: report.targetType,
        targetId: report.targetId,
        metadata: { reportId: report.id, message },
      },
    });
  }

  if (action === "ban") {
    if (!targetUser) return NextResponse.json({ error: "Target user not found." }, { status: 404 });
    if (isOwner(targetUser)) {
      return NextResponse.json({ error: "You can't ban the site owner." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { isSuspended: true },
    });
    await prisma.session.deleteMany({ where: { userId: targetUser.id } });
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: "moderation",
        title: "You have been banned",
        message: message || "Your account has been banned from Rhythians.",
        url: "/login",
      },
    });
    await prisma.moderationAction.create({
      data: {
        actorId: admin.id,
        action: "user_banned",
        targetType: report.targetType,
        targetId: report.targetId,
        metadata: { reportId: report.id, message },
      },
    });
  }

  const resolved = action === "warn" || action === "ban" || action === "resolve";
  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: resolved ? "resolved" : "dismissed",
      resolverId: admin.id,
      resolvedAt: now,
    },
  });

  return NextResponse.json({ report: { id: updated.id, status: updated.status } });
}
