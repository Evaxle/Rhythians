import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { CATEGORIES, MAX_CATEGORY_LEVEL, type Category } from "@/lib/category-constants";
import { ensureChallengeLevelTable, MAX_CHALLENGE_LEVEL, getUserChallengeLevel } from "@/lib/challenge";
import { getUserCategoryLevels } from "@/lib/categories";
import { isOwner } from "@/lib/auth";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function authorize() {
  const admin = await getSessionUser();
  if (!admin) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canAccessAdmin(admin))) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { admin };
}

export async function GET(_request: Request, { params }: Props) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const [challengeLevel, categoryLevels, titleRows] = await Promise.all([
    getUserChallengeLevel(id),
    getUserCategoryLevels(id),
    prisma.$queryRawUnsafe<Array<{ title: string; color: string }>>('SELECT "title", "color" FROM "UserProfileTitle" WHERE "userId" = $1 LIMIT 1', id),
  ]);
  return NextResponse.json({ challengeLevel, categoryLevels, profileTitle: titleRows[0]?.title ?? "", profileTitleColor: titleRows[0]?.color ?? "#a78bfa", canEditTitle: isOwner(auth.admin) });
}

export async function PATCH(request: Request, { params }: Props) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { challengeLevel?: unknown; categoryLevels?: Record<string, unknown> } | null;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const challengeLevel = Number(body?.challengeLevel);
  if (!Number.isInteger(challengeLevel) || challengeLevel < 0 || challengeLevel > MAX_CHALLENGE_LEVEL) return NextResponse.json({ error: `Main challenge level must be between 0 and ${MAX_CHALLENGE_LEVEL}.` }, { status: 400 });

  const categoryLevels: Array<{ category: Category; level: number }> = [];
  for (const category of CATEGORIES) {
    const level = Number(body?.categoryLevels?.[category]);
    if (!Number.isInteger(level) || level < 0 || level > MAX_CATEGORY_LEVEL) return NextResponse.json({ error: `${category} level must be between 0 and ${MAX_CATEGORY_LEVEL}.` }, { status: 400 });
    categoryLevels.push({ category, level });
  }

  await ensureChallengeLevelTable();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DELETE FROM "UserChallengeLevelOverride" WHERE "userId" = $1', id);
    await tx.$executeRawUnsafe('INSERT INTO "UserChallengeLevelOverride" ("id", "userId", "level", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', randomUUID(), id, challengeLevel);
    for (const entry of categoryLevels) await tx.userCategoryLevel.upsert({ where: { userId_category: { userId: id, category: entry.category } }, create: { userId: id, category: entry.category, level: entry.level }, update: { level: entry.level } });
  });

  await prisma.moderationAction.create({ data: { actorId: admin.id, action: "user_levels_edited", targetType: "user", targetId: id, metadata: { challengeLevel, categoryLevels } } });
  return NextResponse.json({ challengeLevel, categoryLevels });
}
