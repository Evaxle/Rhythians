import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, isOwner } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { CATEGORIES, MAX_CATEGORY_LEVEL, type Category } from "@/lib/category-constants";
import { ensureChallengeLevelTable, MAX_CHALLENGE_LEVEL, getUserChallengeLevel } from "@/lib/challenge";
import { getUserCategoryLevels } from "@/lib/categories";
import { ensureUserRbpSeason, getRbpProfile } from "@/lib/rbp";
import { getUserPointOverrides, setUserPointOverride, syncUserModeScores, type EditablePointSystem } from "@/lib/rhythia-mode-points";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const POINT_SYSTEMS = ["rhp", "rpl", "rps", "rpv", "rbp"] as const;

async function authorize() {
  const admin = await getSessionUser();
  if (!admin) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await canAccessAdmin(admin))) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { admin };
}

async function getPoints(id: string) {
  const mode = await syncUserModeScores(id);
  const overrides = await getUserPointOverrides(id);
  const rbp = await getRbpProfile(id);
  return {
    rhp: overrides.get("rhp") ?? mode.rhp,
    rpl: overrides.get("rpl") ?? mode.rpl,
    rps: overrides.get("rps") ?? mode.rps,
    rpv: overrides.get("rpv") ?? mode.rpv,
    rbp: rbp?.player.rbp ?? 0,
  };
}

export async function GET(_request: Request, { params }: Props) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const [challengeLevel, categoryLevels, titleRows, points] = await Promise.all([
    getUserChallengeLevel(id),
    getUserCategoryLevels(id),
    prisma.$queryRawUnsafe<Array<{ title: string; color: string; neon: boolean }>>('SELECT "title", "color", "neon" FROM "UserProfileTitle" WHERE "userId"=$1 LIMIT 1', id),
    getPoints(id),
  ]);
  return NextResponse.json({ challengeLevel, categoryLevels, profileTitle: titleRows[0]?.title ?? "", profileTitleColor: titleRows[0]?.color ?? "#a78bfa", profileTitleNeon: titleRows[0]?.neon ?? false, canEditTitle: isOwner(auth.admin), points });
}

export async function PATCH(request: Request, { params }: Props) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { challengeLevel?: unknown; categoryLevels?: Record<string, unknown>; points?: Record<string, unknown> } | null;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const hasLevels = body?.challengeLevel !== undefined || body?.categoryLevels !== undefined;
  const hasPoints = body?.points && typeof body.points === "object";
  let challengeLevel: number | undefined;
  let categoryLevels: Array<{ category: Category; level: number }> | undefined;

  if (hasLevels) {
    challengeLevel = Number(body?.challengeLevel);
    if (!Number.isInteger(challengeLevel) || challengeLevel < 0 || challengeLevel > MAX_CHALLENGE_LEVEL) return NextResponse.json({ error: `Main challenge level must be between 0 and ${MAX_CHALLENGE_LEVEL}.` }, { status: 400 });
    categoryLevels = [];
    for (const category of CATEGORIES) {
      const level = Number(body?.categoryLevels?.[category]);
      if (!Number.isInteger(level) || level < 0 || level > MAX_CATEGORY_LEVEL) return NextResponse.json({ error: `${category} level must be between 0 and ${MAX_CATEGORY_LEVEL}.` }, { status: 400 });
      categoryLevels.push({ category, level });
    }
  }

  const pointChanges: Partial<Record<EditablePointSystem | "rbp", number>> = {};
  if (hasPoints) {
    for (const system of POINT_SYSTEMS) {
      if (!(system in (body?.points ?? {}))) continue;
      const value = Number(body?.points?.[system]);
      if (!Number.isFinite(value) || value < 0 || value > 1000000) return NextResponse.json({ error: `${system.toUpperCase()} must be between 0 and 1000000.` }, { status: 400 });
      pointChanges[system] = Math.round(value);
    }
  }

  if (!hasLevels && !Object.keys(pointChanges).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  if (hasLevels) {
    await ensureChallengeLevelTable();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('DELETE FROM "UserChallengeLevelOverride" WHERE "userId"=$1', id);
      await tx.$executeRawUnsafe('INSERT INTO "UserChallengeLevelOverride" ("id","userId","level","createdAt","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', randomUUID(), id, challengeLevel);
      for (const entry of categoryLevels ?? []) await tx.userCategoryLevel.upsert({ where: { userId_category: { userId: id, category: entry.category as never } }, create: { userId: id, category: entry.category as never, level: entry.level }, update: { level: entry.level } });
    });
  }

  for (const system of ["rhp", "rpl", "rps", "rpv"] as const) if (pointChanges[system] !== undefined) await setUserPointOverride(id, system, pointChanges[system] ?? 0);
  if (pointChanges.rbp !== undefined) {
    const rbp = await ensureUserRbpSeason(id);
    if (!rbp) return NextResponse.json({ error: "The current battle season is unavailable." }, { status: 503 });
    await prisma.$executeRawUnsafe('UPDATE "RbpUserSeason" SET "rbp"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2', pointChanges.rbp, rbp.player.id);
  }

  const points = await getPoints(id);
  await prisma.moderationAction.create({ data: { actorId: admin.id, action: "user_progression_edited", targetType: "user", targetId: id, metadata: { challengeLevel, categoryLevels, points: pointChanges } } });
  return NextResponse.json({ challengeLevel, categoryLevels, points });
}
