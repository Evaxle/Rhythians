import { prisma } from "@/lib/db";
import { ensureRankingBaseline, loadRankingConfig, overallRhpFromModes } from "@/lib/ranking-system";
import type { ModePoints } from "@/lib/rhythia-mode-rules";

type ReconcileRow = {
  userId: string;
  currentRhp: number;
  overallFloor: number;
  rplBase: number;
  rpsBase: number;
  rpvBase: number;
  rawLock: number;
  rawSpin: number;
  rawVr: number;
  rplOverride: number | null;
  rpsOverride: number | null;
  rpvOverride: number | null;
  rhpOverride: number | null;
};

function calculate(row: ReconcileRow, config: Awaited<ReturnType<typeof loadRankingConfig>>) {
  const totals: ModePoints = {
    lock: row.rplOverride ?? row.rplBase + row.rawLock,
    spin: row.rpsOverride ?? row.rpsBase + row.rawSpin,
    vr: row.rpvOverride ?? row.rpvBase + row.rawVr,
  };
  const rhp = row.rhpOverride ?? overallRhpFromModes(totals, row.overallFloor, config);
  return { rhp: Math.max(0, Math.round(rhp)), rpl: totals.lock, rps: totals.spin, rpv: totals.vr };
}

async function rowForUser(userId: string): Promise<ReconcileRow | null> {
  await ensureRankingBaseline(userId);
  const rows = await prisma.$queryRawUnsafe<ReconcileRow[]>(`
    SELECT u.id AS "userId",u.rhp::int AS "currentRhp",
      COALESCE(b."overallFloor",0)::int AS "overallFloor",
      COALESCE(b."rplBase",0)::int AS "rplBase",
      COALESCE(b."rpsBase",0)::int AS "rpsBase",
      COALESCE(b."rpvBase",0)::int AS "rpvBase",
      COALESCE(s.lock,0)::int AS "rawLock",
      COALESCE(s.spin,0)::int AS "rawSpin",
      COALESCE(s.vr,0)::int AS "rawVr",
      rpl.points::int AS "rplOverride",rps.points::int AS "rpsOverride",
      rpv.points::int AS "rpvOverride",rhp.points::int AS "rhpOverride"
    FROM "User" u
    LEFT JOIN "RankingBaseline" b ON b."userId"=u.id
    LEFT JOIN (
      SELECT "userId",
        SUM(points) FILTER (WHERE "cameraMode"='lock') AS lock,
        SUM(points) FILTER (WHERE "cameraMode"='spin') AS spin,
        SUM(points) FILTER (WHERE "cameraMode"='vr') AS vr
      FROM "RhythiaModeScore" GROUP BY "userId"
    ) s ON s."userId"=u.id
    LEFT JOIN "UserPointOverride" rpl ON rpl."userId"=u.id AND rpl.system='rpl'
    LEFT JOIN "UserPointOverride" rps ON rps."userId"=u.id AND rps.system='rps'
    LEFT JOIN "UserPointOverride" rpv ON rpv."userId"=u.id AND rpv.system='rpv'
    LEFT JOIN "UserPointOverride" rhp ON rhp."userId"=u.id AND rhp.system='rhp'
    WHERE u.id=$1 LIMIT 1`, userId);
  return rows[0] ?? null;
}

export async function reconcileStoredRhp(userId: string) {
  const [row, config] = await Promise.all([rowForUser(userId), loadRankingConfig()]);
  if (!row) return null;
  const next = calculate(row, config);
  if (next.rhp !== row.currentRhp) await prisma.user.update({ where: { id: userId }, data: { rhp: next.rhp } });
  return { ...next, changed: next.rhp !== row.currentRhp };
}

export async function reconcileAllStoredRhp() {
  const missing = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(`SELECT rp."userId" FROM "RhythiaProfile" rp LEFT JOIN "RankingBaseline" b ON b."userId"=rp."userId" WHERE b."userId" IS NULL`);
  await Promise.all(missing.map(({ userId }) => ensureRankingBaseline(userId)));
  const config = await loadRankingConfig();
  const rows = await prisma.$queryRawUnsafe<ReconcileRow[]>(`
    SELECT u.id AS "userId",u.rhp::int AS "currentRhp",
      COALESCE(b."overallFloor",0)::int AS "overallFloor",
      COALESCE(b."rplBase",0)::int AS "rplBase",
      COALESCE(b."rpsBase",0)::int AS "rpsBase",
      COALESCE(b."rpvBase",0)::int AS "rpvBase",
      COALESCE(s.lock,0)::int AS "rawLock",
      COALESCE(s.spin,0)::int AS "rawSpin",
      COALESCE(s.vr,0)::int AS "rawVr",
      rpl.points::int AS "rplOverride",rps.points::int AS "rpsOverride",
      rpv.points::int AS "rpvOverride",rhp.points::int AS "rhpOverride"
    FROM "User" u
    LEFT JOIN "RankingBaseline" b ON b."userId"=u.id
    LEFT JOIN (
      SELECT "userId",
        SUM(points) FILTER (WHERE "cameraMode"='lock') AS lock,
        SUM(points) FILTER (WHERE "cameraMode"='spin') AS spin,
        SUM(points) FILTER (WHERE "cameraMode"='vr') AS vr
      FROM "RhythiaModeScore" GROUP BY "userId"
    ) s ON s."userId"=u.id
    LEFT JOIN "UserPointOverride" rpl ON rpl."userId"=u.id AND rpl.system='rpl'
    LEFT JOIN "UserPointOverride" rps ON rps."userId"=u.id AND rps.system='rps'
    LEFT JOIN "UserPointOverride" rpv ON rpv."userId"=u.id AND rpv.system='rpv'
    LEFT JOIN "UserPointOverride" rhp ON rhp."userId"=u.id AND rhp.system='rhp'
    WHERE u."profileHandle" <> 'rhythia-imports'`);
  const changed = rows.map((row) => ({ row, next: calculate(row, config) })).filter(({ row, next }) => row.currentRhp !== next.rhp);
  if (changed.length) await prisma.$transaction(changed.map(({ row, next }) => prisma.user.update({ where: { id: row.userId }, data: { rhp: next.rhp } })));
  return { checked: rows.length, changed: changed.length };
}
