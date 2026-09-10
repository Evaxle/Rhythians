import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { syncUserModeScores } from "@/lib/rhythia-mode-points";
import { placeBattleRanks } from "@/lib/rbp-placement";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "sync-passes";

  if (action === "replace-all-battle-ranks") {
    const result = await placeBattleRanks(undefined, true);
    if (!result.season) return NextResponse.json({ error: "There is no active battle season." }, { status: 409 });
    await prisma.moderationAction.create({ data: { actorId: admin.id, action: "battle_ranks_replaced", targetType: "rbp_season", targetId: result.season.id, metadata: { seasonNumber: result.season.seasonNumber, changed: result.changed } } });
    return NextResponse.json({ ok: true, changed: result.changed, seasonNumber: result.season.seasonNumber });
  }

  if (action !== "sync-passes") {
    return NextResponse.json({ error: "Legacy RP/manual rank actions are disabled. Ranking points are earned from passing analyzed maps only." }, { status: 400 });
  }

  const userIds = Array.isArray(body?.userIds) ? [...new Set(body.userIds.filter((value): value is string => typeof value === "string" && value.length > 0))] : [];
  if (!userIds.length) return NextResponse.json({ error: "Select at least one player." }, { status: 400 });
  if (userIds.length > 500) return NextResponse.json({ error: "You can update at most 500 players at once." }, { status: 400 });

  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, rhythiaProfile: { select: { profileId: true } } } });
  if (users.length !== userIds.length) return NextResponse.json({ error: "One or more selected players could not be found." }, { status: 404 });

  let changed = 0;
  let skipped = 0;
  const failures: string[] = [];
  const results: Array<{ userId: string; rpl: number; rps: number; rpv: number; rhp: number }> = [];

  for (const user of users) {
    if (!user.rhythiaProfile?.profileId) { skipped += 1; continue; }
    try {
      const result = await syncUserModeScores(user.id);
      const values = { userId: user.id, rpl: result.rpl, rps: result.rps, rpv: result.rpv, rhp: result.rhp };
      results.push(values);
      changed += 1;
      await prisma.moderationAction.create({ data: { actorId: admin.id, action: "ranking_passes_synced", targetType: "user", targetId: user.id, metadata: { ...values, bulk: users.length > 1 } } });
    } catch (error) {
      failures.push(`${user.username}: ${error instanceof Error ? error.message : "Rhythia scores could not be synced."}`);
    }
  }

  if (changed === 0 && failures.length) return NextResponse.json({ error: `No players were updated. ${failures.slice(0, 3).join(" ")}` }, { status: 502 });
  return NextResponse.json({ ok: true, changed, skipped, failed: failures.length, failures: failures.slice(0, 10), results });
}
