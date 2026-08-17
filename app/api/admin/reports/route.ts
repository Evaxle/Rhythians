import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(sessionUser))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reports = await prisma.report.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reporter: { select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true } },
      resolver: { select: { id: true, username: true } },
    },
  });

  const userIds = new Set<string>();
  const clipIds = new Set<string>();
  for (const report of reports) {
    if (report.targetType === "user") userIds.add(report.targetId);
    if (report.targetType === "clip") clipIds.add(report.targetId);
  }

  const [targetUsers, targetClips, bannedUsers] = await Promise.all([
    userIds.size
      ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, username: true, discriminator: true, profileHandle: true, isSuspended: true, avatar: true } })
      : [],
    clipIds.size
      ? prisma.clip.findMany({
          where: { id: { in: [...clipIds] } },
          select: { id: true, title: true, status: true, uploader: { select: { id: true, username: true } } },
        })
      : [],
    prisma.user.findMany({
      where: { isSuspended: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true, isSuspended: true, updatedAt: true },
    }),
  ]);

  const userById = new Map(targetUsers.map((u) => [u.id, u]));
  const clipById = new Map(targetClips.map((c) => [c.id, c]));

  return NextResponse.json({
    reports: reports.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      reporter: report.reporter,
      resolver: report.resolver,
      targetUser: report.targetType === "user" ? (userById.get(report.targetId) ?? null) : null,
      targetClip: report.targetType === "clip" ? (clipById.get(report.targetId) ?? null) : null,
    })),
    bannedUsers: bannedUsers.map((user) => ({
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      profileHandle: user.profileHandle,
      avatar: user.avatar,
      bannedAt: user.updatedAt.toISOString(),
    })),
  });
}
