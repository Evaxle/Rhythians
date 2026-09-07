import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { RANKS, getRankInfo } from "@/lib/ranks";
import { fetchRhythiaModeRp } from "@/lib/rhythia";
import { getUserPointOverrides, setUserPointOverride } from "@/lib/rhythia-mode-points";
import { getCachedModePoints } from "@/lib/profile-points";

export const dynamic = "force-dynamic";

function balancedPoints(total: number, current: { lock: number; spin: number; vr: number }) {
  const values = [Math.max(0, current.lock), Math.max(0, current.spin), Math.max(0, current.vr)];
  const currentTotal = values.reduce((sum, value) => sum + value, 0);
  if (currentTotal <= 0) {
    const base = Math.floor(total / 3);
    return { rpl: base + (total % 3 > 0 ? 1 : 0), rps: base + (total % 3 > 1 ? 1 : 0), rpv: base };
  }
  const exact = values.map((value) => total * value / currentTotal);
  const rounded = exact.map(Math.floor);
  let remaining = total - rounded.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remaining; i++) rounded[order[i % order.length].index]++;
  return { rpl: rounded[0], rps: rounded[1], rpv: rounded[2] };
}

async function applyPoints(userId: string, points: { rpl: number; rps: number; rpv: number }) {
  const rhp = points.rpl + points.rps + points.rpv;
  await Promise.all([
    setUserPointOverride(userId, "rpl", points.rpl),
    setUserPointOverride(userId, "rps", points.rps),
    setUserPointOverride(userId, "rpv", points.rpv),
    setUserPointOverride(userId, "rhp", rhp),
  ]);
  await prisma.user.update({ where: { id: userId }, data: { rhp } });
  return rhp;
}

export async function PATCH(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const userIds = Array.isArray(body?.userIds) ? [...new Set(body.userIds.filter((value): value is string => typeof value === "string" && value.length > 0))] : [];
  const action = typeof body?.action === "string" ? body.action : "set-rank";

  if (!userIds.length) return NextResponse.json({ error: "Select at least one player." }, { status: 400 });
  if (userIds.length > 200) return NextResponse.json({ error: "You can update at most 200 players at once." }, { status: 400 });

  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, profileHandle: true, rhp: true, rhythiaProfile: { select: { profileId: true } } } });
  if (users.length !== userIds.length) return NextResponse.json({ error: "One or more selected players could not be found." }, { status: 404 });

  if (action === "use-rp") {
    if (users.length !== 1) return NextResponse.json({ error: "Use RP can update one player at a time." }, { status: 400 });
    const user = users[0];
    if (!user.rhythiaProfile?.profileId) return NextResponse.json({ error: "This player does not have a linked Rhythia profile." }, { status: 400 });
    const source = await fetchRhythiaModeRp(user.rhythiaProfile.profileId);
    const points = { rpl: Math.round(source.lock / 2), rps: Math.round(source.spin / 2), rpv: Math.round(source.vr / 2) };
    const rhp = await applyPoints(user.id, points);
    await prisma.moderationAction.create({ data: { actorId: admin.id, action: "rhythia_rp_applied", targetType: "user", targetId: user.id, metadata: { source, divisor: 2, ...points, rhp } } });
    return NextResponse.json({ ok: true, rhp, points, source });
  }

  const explicitRhp = body?.rhp !== undefined ? Number(body.rhp) : null;
  const rankIndex = Number(body?.rankIndex);
  if (explicitRhp != null && (!Number.isInteger(explicitRhp) || explicitRhp < 0 || explicitRhp > 1000000)) return NextResponse.json({ error: "RHP must be a whole number between 0 and 1000000." }, { status: 400 });
  if (explicitRhp == null && (!Number.isInteger(rankIndex) || rankIndex < 0 || rankIndex >= RANKS.length)) return NextResponse.json({ error: "Invalid rank." }, { status: 400 });

  const targetRhp = explicitRhp ?? RANKS[rankIndex].minRhp;
  const targetRank = getRankInfo(targetRhp);
  let changed = 0;
  for (const user of users) {
    const current = await getCachedModePoints(user.id);
    const points = balancedPoints(targetRhp, current.points);
    const rhp = await applyPoints(user.id, points);
    changed++;
    await prisma.moderationAction.create({ data: { actorId: admin.id, action: explicitRhp != null ? "rhp_balanced" : "rank_changed", targetType: "user", targetId: user.id, metadata: { fromRank: getRankInfo(user.rhp).name, fromRhp: user.rhp, toRank: targetRank.name, toRhp: rhp, ...points } } });
  }

  if (explicitRhp == null && users.length) {
    await prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, type: "rank_change", title: "Rank updated", message: `Your rank has been changed to ${targetRank.name}.`, url: `/profile/${encodeURIComponent(user.profileHandle)}` })) });
  }

  return NextResponse.json({ ok: true, changed, rank: targetRank.name, rhp: targetRhp });
}
