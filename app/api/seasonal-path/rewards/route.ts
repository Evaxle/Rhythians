import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RANKS } from "@/lib/ranks";

export const dynamic = "force-dynamic";

async function getRewards(userId: string) {
  const seasons = await prisma.$queryRawUnsafe<Array<{ id: string; seasonNumber: number; finalizedAt: Date | null }>>('SELECT "id", "seasonNumber", "finalizedAt" FROM "SeasonalPathSeason" WHERE "finalizedAt" IS NOT NULL ORDER BY "seasonNumber" DESC');
  const rewards: Array<{ seasonNumber: number; rankIndex: number; rankName: string; color: string }> = [];
  for (const season of seasons) {
    const rows = await prisma.$queryRawUnsafe<Array<{ maxRank: number | null }>>('SELECT MAX("rankIndex")::int AS "maxRank" FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "userId" = $2', season.id, userId);
    const maxRank = rows[0]?.maxRank ?? -1;
    for (let rankIndex = 0; rankIndex <= Math.min(maxRank, RANKS.length - 1); rankIndex += 1) {
      const slug = `season-${season.seasonNumber}-${RANKS[rankIndex].name.toLowerCase()}`;
      const owned = await prisma.tag.findUnique({ where: { slug }, select: { id: true, userTags: { where: { userId }, select: { id: true } } } });
      if (!owned?.userTags.length) rewards.push({ seasonNumber: season.seasonNumber, rankIndex, rankName: RANKS[rankIndex].name, color: RANKS[rankIndex].color });
    }
  }
  return rewards.sort((a, b) => a.seasonNumber - b.seasonNumber || a.rankIndex - b.rankIndex);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ rewards: [] });
  return NextResponse.json({ rewards: await getRewards(user.id) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { seasonNumber?: unknown; rankIndex?: unknown } | null;
  const seasonNumber = Number(body?.seasonNumber);
  const rankIndex = Number(body?.rankIndex);
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(rankIndex) || !RANKS[rankIndex]) return NextResponse.json({ error: "Invalid reward" }, { status: 400 });
  const season = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "SeasonalPathSeason" WHERE "seasonNumber" = $1 AND "finalizedAt" IS NOT NULL LIMIT 1', seasonNumber);
  if (!season[0]) return NextResponse.json({ error: "Season is not finalized" }, { status: 400 });
  const completion = await prisma.$queryRawUnsafe<Array<{ maxRank: number | null }>>('SELECT MAX("rankIndex")::int AS "maxRank" FROM "SeasonalPathCompletion" WHERE "seasonId" = $1 AND "userId" = $2', season[0].id, user.id);
  if ((completion[0]?.maxRank ?? -1) < rankIndex) return NextResponse.json({ error: "You did not reach this rank." }, { status: 403 });
  const name = `Season ${seasonNumber} ${RANKS[rankIndex].name}`;
  const slug = `season-${seasonNumber}-${RANKS[rankIndex].name.toLowerCase()}`;
  const tag = await prisma.tag.upsert({ where: { slug }, update: { name }, create: { name, slug } });
  await prisma.userTag.upsert({ where: { userId_tagId: { userId: user.id, tagId: tag.id } }, update: { source: "manual" }, create: { userId: user.id, tagId: tag.id, source: "manual" } });
  return NextResponse.json({ success: true });
}
