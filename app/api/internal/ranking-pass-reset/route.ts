import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearRankingForFullRebuild, rebuildRankingUsers } from "@/lib/ranking-system";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const TOKEN = "pass-reset-2026-09-10-7f3c91b2";

function allowed(request: Request) {
  const url = new URL(request.url);
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.VERCEL_GIT_COMMIT_REF !== "ranking-pass-only-reset") return false;
  return url.searchParams.get("token") === TOKEN;
}

export async function GET(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "status";

  if (action === "reset") {
    await clearRankingForFullRebuild();
    const linked = await prisma.rhythiaProfile.count();
    return NextResponse.json({ ok: true, reset: true, linked });
  }

  if (action === "batch") {
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0));
    const limit = Math.max(1, Math.min(10, Math.floor(Number(url.searchParams.get("limit")) || 5)));
    const profiles = await prisma.rhythiaProfile.findMany({ select: { userId: true }, orderBy: { userId: "asc" }, skip: offset, take: limit });
    const results = await rebuildRankingUsers(profiles.map((profile) => profile.userId));
    return NextResponse.json({ ok: true, offset, processed: profiles.length, results, nextOffset: offset + profiles.length });
  }

  if (action === "status") {
    const rows = await prisma.$queryRawUnsafe<Array<{ linked: number; modeRows: number; usersWithRhp: number; mismatches: number }>>(`
      SELECT
        (SELECT COUNT(*)::int FROM "RhythiaProfile") AS linked,
        (SELECT COUNT(*)::int FROM "RhythiaModeScore") AS "modeRows",
        (SELECT COUNT(*)::int FROM "User" WHERE rhp > 0) AS "usersWithRhp",
        (SELECT COUNT(*)::int FROM (
          SELECT u.id
          FROM "User" u
          LEFT JOIN "RhythiaModeScore" s ON s."userId"=u.id
          WHERE u."profileHandle" <> 'rhythia-imports'
          GROUP BY u.id,u.rhp
          HAVING u.rhp <> COALESCE(SUM(s.points),0)::int
        ) q) AS mismatches`);
    return NextResponse.json({ ok: true, status: rows[0] ?? null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
