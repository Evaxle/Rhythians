import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { CATEGORIES, isCategory, MAX_CATEGORY_LEVEL, type Category } from "@/lib/category-constants";
import { getUserCategoryLevel } from "@/lib/categories";
import { ensureChallengeLevelTable, getUserChallengeLevel, MAX_CHALLENGE_LEVEL } from "@/lib/challenge";

const TABLE_CATEGORY = "CompletionClip";
const TABLE_CHALLENGE = "ChallengeCompletionClip";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  const body = await request.json().catch(() => null) as { kind?: string; category?: string; level?: number; mapName?: string; storagePath?: string } | null;
  const kind = body?.kind === "challenge" ? "challenge" : "category";
  const level = Number(body?.level);
  const mapName = body?.mapName?.trim();
  const storagePath = body?.storagePath?.trim();
  if (!Number.isInteger(level) || level < 7 || level > 10) return NextResponse.json({ error: "Completion clips are only available for levels 7-10." }, { status: 400 });
  if (!mapName || mapName.length > 160) return NextResponse.json({ error: "Map name is required." }, { status: 400 });
  if (!storagePath || !storagePath.startsWith(`${process.env.STORAGE_BUCKET ?? "media"}/completion-clips/${user.id}/`)) return NextResponse.json({ error: "Invalid completion video." }, { status: 400 });

  if (kind === "category") {
    if (!isCategory(body?.category) || !CATEGORIES.includes(body.category as Category)) return NextResponse.json({ error: "Choose a valid category." }, { status: 400 });
    const category = body.category as Category;
    const currentLevel = await getUserCategoryLevel(user.id, category);
    if (currentLevel !== level - 1) return NextResponse.json({ error: `User is not level ${level - 1} in ${category}. You must complete levels in order.` }, { status: 409 });
    const pending = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "${TABLE_CATEGORY}" WHERE "userId" = $1 AND "category" = $2 AND "level" = $3 AND "status" = 'pending' LIMIT 1`, user.id, category, level);
    if (pending[0]) return NextResponse.json({ error: "You already have a completion clip awaiting review for this level." }, { status: 409 });
    await prisma.$executeRawUnsafe(`INSERT INTO "${TABLE_CATEGORY}" ("id","userId","category","level","mapName","storagePath","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), user.id, category, level, mapName, storagePath);
  } else {
    await ensureChallengeLevelTable();
    const currentLevel = await getUserChallengeLevel(user.id);
    if (currentLevel !== level - 1) return NextResponse.json({ error: `User is not level ${level - 1} in Challenge. You must complete levels in order.` }, { status: 409 });
    const pending = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "${TABLE_CHALLENGE}" WHERE "userId" = $1 AND "level" = $2 AND "status" = 'pending' LIMIT 1`, user.id, level);
    if (pending[0]) return NextResponse.json({ error: "You already have a Challenge completion clip awaiting review for this level." }, { status: 409 });
    await prisma.$executeRawUnsafe(`INSERT INTO "${TABLE_CHALLENGE}" ("id","userId","level","mapName","storagePath","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,'pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), user.id, level, mapName, storagePath);
  }

  return NextResponse.json({ ok: true, level, category: kind === "category" ? body?.category : null });
}
