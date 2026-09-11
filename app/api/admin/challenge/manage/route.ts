import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { ensureChallengeLevelTable } from "@/lib/challenge";
import { ensureCompletionClipTables } from "@/lib/completion-clips";

const tabs = ["challenge", "jumps", "stream", "tech", "off_grid", "vibro"] as const;
type Tab = typeof tabs[number];
const PAGE_SIZE = 10;

async function authorize() {
  const user = await getSessionUser();
  if (!user || !(await canAccessAdmin(user))) return null;
  return user;
}

export async function GET(request: Request) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") ?? "challenge") as Tab;
  const q = (url.searchParams.get("q") ?? "").trim();
  const levelValue = url.searchParams.get("level");
  const level = levelValue ? Number(levelValue) : null;
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? Math.min(rawOffset, 100000) : 0;
  if (!tabs.includes(tab)) return NextResponse.json({ error: "Invalid tab." }, { status: 400 });
  if (level != null && (!Number.isInteger(level) || level < 1 || level > 10)) return NextResponse.json({ error: "Invalid level." }, { status: 400 });

  if (tab === "challenge") {
    await ensureChallengeLevelTable();
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT m."id", m."title", m."artist", m."mapperName", m."mapFileUrl", m."rating", m."status", l."level" FROM "ChallengeMap" m LEFT JOIN "ChallengeMapLevel" l ON l."challengeMapId" = m."id" WHERE ($1 = '' OR m."title" ILIKE '%' || $1 || '%' OR COALESCE(m."artist",'') ILIKE '%' || $1 || '%' OR COALESCE(m."mapperName",'') ILIKE '%' || $1 || '%') AND ($2::integer IS NULL OR l."level" = $2) ORDER BY m."createdAt" DESC LIMIT $3 OFFSET $4`, q, level, PAGE_SIZE + 1, offset);
    const hasMore = rows.length > PAGE_SIZE;
    return NextResponse.json({ maps: rows.slice(0, PAGE_SIZE), hasMore, nextOffset: hasMore ? offset + PAGE_SIZE : null });
  }

  await ensureCompletionClipTables();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT m."id", m."title", m."artist", m."mapperName", m."mapFileUrl", m."status", m."level", m."category"::text AS "category" FROM "CategoryMap" m WHERE m."category"::text = $1 AND ($2 = '' OR m."title" ILIKE '%' || $2 || '%' OR COALESCE(m."artist",'') ILIKE '%' || $2 || '%' OR COALESCE(m."mapperName",'') ILIKE '%' || $2 || '%') AND ($3::integer IS NULL OR m."level" = $3) ORDER BY m."createdAt" DESC LIMIT $4 OFFSET $5`, tab, q, level, PAGE_SIZE + 1, offset);
  const hasMore = rows.length > PAGE_SIZE;
  return NextResponse.json({ maps: rows.slice(0, PAGE_SIZE), hasMore, nextOffset: hasMore ? offset + PAGE_SIZE : null });
}

export async function PATCH(request: Request) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { fromTab?: string; tab?: string; mapId?: string; level?: number } | null;
  const fromTab = body?.fromTab as Tab;
  const targetTab = body?.tab as Tab;
  const level = Number(body?.level);
  if (!tabs.includes(fromTab) || !tabs.includes(targetTab) || !body?.mapId || !Number.isInteger(level) || level < 1 || level > 10) return NextResponse.json({ error: "Choose a valid category and level 1-10." }, { status: 400 });

  await ensureCompletionClipTables();
  await ensureChallengeLevelTable();

  if (fromTab === "challenge") {
    const map = await prisma.challengeMap.findUnique({ where: { id: body.mapId } });
    if (!map) return NextResponse.json({ error: "Challenge map not found." }, { status: 404 });

    if (targetTab === "challenge") {
      await prisma.$executeRawUnsafe(`INSERT INTO "ChallengeMapLevel" ("id","challengeMapId","level","createdAt","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("challengeMapId") DO UPDATE SET "level" = EXCLUDED."level", "updatedAt" = CURRENT_TIMESTAMP`, randomUUID(), map.id, level);
      return NextResponse.json({ ok: true, category: targetTab, level });
    }

    const existing = map.sourceBeatmapId != null ? await prisma.categoryMap.findUnique({ where: { sourceBeatmapId: map.sourceBeatmapId } }) : null;
    if (existing) {
      await prisma.categoryMap.update({ where: { id: existing.id }, data: { category: targetTab as never, level, status: "approved", reviewedById: admin.id, reviewedAt: new Date() } });
    } else {
      await prisma.categoryMap.create({ data: { category: targetTab as never, level, title: map.title, artist: map.artist, description: map.description, mapFileUrl: map.mapFileUrl, imageUrl: map.imageUrl, mapperName: map.mapperName, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.sourceBeatmapId, sourceUrl: map.sourceUrl, submittedById: admin.id, status: "approved", reviewedById: admin.id, reviewedAt: new Date() } });
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "ChallengeMapLevel" WHERE "challengeMapId"=$1`, map.id);
    return NextResponse.json({ ok: true, category: targetTab, level });
  }

  const map = await prisma.categoryMap.findUnique({ where: { id: body.mapId } });
  if (!map) return NextResponse.json({ error: "Category map not found." }, { status: 404 });

  if (targetTab !== "challenge") {
    await prisma.categoryMap.update({ where: { id: map.id }, data: { category: targetTab as never, level, status: "approved", reviewedById: admin.id, reviewedAt: new Date() } });
    return NextResponse.json({ ok: true, category: targetTab, level });
  }

  const challenge = map.sourceBeatmapId != null ? await prisma.challengeMap.findFirst({ where: { sourceBeatmapId: map.sourceBeatmapId } }) : null;
  if (!challenge) return NextResponse.json({ error: "This category map has no matching Challenge source map, so it cannot be moved to Challenge safely." }, { status: 400 });
  await prisma.$executeRawUnsafe(`INSERT INTO "ChallengeMapLevel" ("id","challengeMapId","level","createdAt","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("challengeMapId") DO UPDATE SET "level" = EXCLUDED."level", "updatedAt" = CURRENT_TIMESTAMP`, randomUUID(), challenge.id, level);
  await prisma.categoryMap.update({ where: { id: map.id }, data: { status: "hidden", reviewedById: admin.id, reviewedAt: new Date() } });
  return NextResponse.json({ ok: true, category: targetTab, level });
}

export async function DELETE(request: Request) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { tab?: string; mapId?: string } | null;
  const tab = body?.tab as Tab;
  if (!tabs.includes(tab) || !body?.mapId) return NextResponse.json({ error: "Choose a valid map." }, { status: 400 });

  if (tab === "challenge") {
    await ensureChallengeLevelTable();
    await prisma.$executeRawUnsafe(`DELETE FROM "ChallengeMapLevel" WHERE "challengeMapId"=$1`, body.mapId);
    return NextResponse.json({ ok: true, removed: true });
  }

  const map = await prisma.categoryMap.findUnique({ where: { id: body.mapId } });
  if (!map) return NextResponse.json({ error: "Category map not found." }, { status: 404 });
  await prisma.categoryMap.update({ where: { id: map.id }, data: { status: "hidden", reviewedById: admin.id, reviewedAt: new Date() } });
  return NextResponse.json({ ok: true, removed: true });
}
