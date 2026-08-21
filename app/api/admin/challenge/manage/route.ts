import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { ensureChallengeLevelTable } from "@/lib/challenge";
import { ensureCompletionClipTables } from "@/lib/completion-clips";

const tabs = ["challenge", "jumps", "stream", "tech", "off_grid", "vibro"] as const;

type Tab = typeof tabs[number];

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
  if (!tabs.includes(tab)) return NextResponse.json({ error: "Invalid tab." }, { status: 400 });
  if (tab === "challenge") {
    await ensureChallengeLevelTable();
    return NextResponse.json(await prisma.$queryRawUnsafe(`SELECT m."id", m."title", m."artist", m."mapperName", m."mapFileUrl", m."rating", m."status", l."level" FROM "ChallengeMap" m LEFT JOIN "ChallengeMapLevel" l ON l."challengeMapId" = m."id" WHERE ($1 = '' OR m."title" ILIKE '%' || $1 || '%' OR COALESCE(m."artist",'') ILIKE '%' || $1 || '%' OR COALESCE(m."mapperName",'') ILIKE '%' || $1 || '%') ORDER BY m."createdAt" DESC LIMIT 100`, q));
  }
  await ensureCompletionClipTables();
  return NextResponse.json(await prisma.$queryRawUnsafe(`SELECT m."id", m."title", m."artist", m."mapperName", m."mapFileUrl", m."status", m."level", m."category"::text AS "category" FROM "CategoryMap" m WHERE ($1 = '' OR m."title" ILIKE '%' || $1 || '%' OR COALESCE(m."artist",'') ILIKE '%' || $1 || '%' OR COALESCE(m."mapperName",'') ILIKE '%' || $1 || '%') ORDER BY m."createdAt" DESC LIMIT 100`, q));
}

export async function PATCH(request: Request) {
  const admin = await authorize();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { tab?: string; mapId?: string; level?: number } | null;
  const tab = body?.tab as Tab;
  const level = Number(body?.level);
  if (!tabs.includes(tab) || !body?.mapId || !Number.isInteger(level) || level < 1 || level > 10) return NextResponse.json({ error: "Choose a valid category and level 1-10." }, { status: 400 });
  await ensureCompletionClipTables();
  if (tab === "challenge") {
    const map = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`, body.mapId);
    if (!map[0]) return NextResponse.json({ error: "Map not found." }, { status: 404 });
    await ensureChallengeLevelTable();
    await prisma.$executeRawUnsafe(`INSERT INTO "ChallengeMapLevel" ("id","challengeMapId","level","createdAt","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("challengeMapId") DO UPDATE SET "level" = EXCLUDED."level", "updatedAt" = CURRENT_TIMESTAMP`, randomUUID(), body.mapId, level);
    return NextResponse.json({ ok: true, level });
  }
  const map = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; mapperName: string | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null }>>(`SELECT "id","title","artist","description","mapFileUrl","imageUrl","mapperName","noteCount","length","sourceBeatmapId" FROM "CategoryMap" WHERE "id" = $1 LIMIT 1`, body.mapId);
  if (!map[0]) {
    const challenge = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; mapperName: string | null; noteCount: number | null; length: number | null; sourceBeatmapId: number | null }>>(`SELECT "id","title","artist","description","mapFileUrl","imageUrl","mapperName","noteCount","length","sourceBeatmapId" FROM "ChallengeMap" WHERE "id" = $1 LIMIT 1`, body.mapId);
    if (!challenge[0]) return NextResponse.json({ error: "Map not found." }, { status: 404 });
    await prisma.$executeRawUnsafe(`INSERT INTO "CategoryMap" ("id","category","level","title","artist","description","mapFileUrl","imageUrl","mapperName","noteCount","length","sourceBeatmapId","sourceUrl","submittedById","status","createdAt","updatedAt") VALUES ($1,$2::"CategoryType",$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,$13,'approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), tab, level, challenge[0].title, challenge[0].artist, challenge[0].description, challenge[0].mapFileUrl, challenge[0].imageUrl, challenge[0].mapperName, challenge[0].noteCount, challenge[0].length, challenge[0].sourceBeatmapId, admin.id);
  } else {
    await prisma.$executeRawUnsafe(`UPDATE "CategoryMap" SET "category" = $1::"CategoryType", "level" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $3`, tab, level, body.mapId);
  }
  return NextResponse.json({ ok: true, category: tab, level });
}
