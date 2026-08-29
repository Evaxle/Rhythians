import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { RANKS, getRankInfo } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const userIds = Array.isArray(body?.userIds) ? [...new Set(body.userIds.filter((value): value is string => typeof value === "string" && value.length > 0))] : [];
  const rankIndex = Number(body?.rankIndex);

  if (!userIds.length) return NextResponse.json({ error: "Select at least one player." }, { status: 400 });
  if (!Number.isInteger(rankIndex) || rankIndex < 0 || rankIndex >= RANKS.length) return NextResponse.json({ error: "Invalid rank." }, { status: 400 });
  if (userIds.length > 200) return NextResponse.json({ error: "You can update at most 200 players at once." }, { status: 400 });

  const targetRank = RANKS[rankIndex];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, profileHandle: true, rhp: true } });
  if (users.length !== userIds.length) return NextResponse.json({ error: "One or more selected players could not be found." }, { status: 404 });

  const changedUsers = users.filter((user) => getRankInfo(user.rhp).index !== rankIndex || user.rhp !== targetRank.minRhp);

  if (changedUsers.length > 0) {
    await prisma.user.updateMany({ where: { id: { in: changedUsers.map((user) => user.id) } }, data: { rhp: targetRank.minRhp } });

    await prisma.moderationAction.createMany({
      data: changedUsers.map((user) => ({
        actorId: admin.id,
        action: "rank_changed",
        targetType: "user",
        targetId: user.id,
        metadata: { fromRank: getRankInfo(user.rhp).name, fromRhp: user.rhp, toRank: targetRank.name, toRhp: targetRank.minRhp },
      })),
    });

    await prisma.notification.createMany({
      data: changedUsers.map((user) => ({
        userId: user.id,
        type: "rank_change",
        title: "Rank updated",
        message: `Your rank has been changed to ${targetRank.name}.`,
        url: `/profile/${encodeURIComponent(user.profileHandle)}`,
      })),
    });
  }

  return NextResponse.json({ ok: true, changed: changedUsers.length, rank: targetRank.name, rhp: targetRank.minRhp });
}
