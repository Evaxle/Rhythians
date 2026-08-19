import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { ensureChallengeLevelTable } from "@/lib/challenge";
import { rhpGainForMap, rankIndexForRating, roundRating } from "@/lib/ranks";

export const dynamic = "force-dynamic";

async function ensureRhpOverrideColumn() {
  await prisma.$executeRawUnsafe('ALTER TABLE "ChallengeMap" ADD COLUMN IF NOT EXISTS "rhpOverride" INTEGER');
}

export async function POST(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() || null : null;
  const mapperName = typeof body?.mapperName === "string" ? body.mapperName.trim() || null : null;
  const mapFileUrl = typeof body?.mapFileUrl === "string" ? body.mapFileUrl.trim() : "";
  const requestedRating = Number(body?.rating);
  const noteCount = body?.noteCount == null || body.noteCount === "" ? null : Number(body.noteCount);
  const length = body?.length == null || body.length === "" ? null : Number(body.length);
  const category = typeof body?.category === "string" ? body.category : null;
  const categoryLevel = body?.categoryLevel == null || body.categoryLevel === "" ? null : Number(body.categoryLevel);
  const challengeLevel = body?.challengeLevel == null || body.challengeLevel === "" ? null : Number(body.challengeLevel);
  const rhpOverride = body?.rhpOverride == null || body.rhpOverride === "" ? null : Number(body.rhpOverride);

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!mapFileUrl) return NextResponse.json({ error: "Map file upload is required." }, { status: 400 });
  if (!Number.isFinite(requestedRating) || requestedRating < 0 || requestedRating > 9.99) return NextResponse.json({ error: "Rating must be between 0 and 9.99." }, { status: 400 });
  if (noteCount != null && (!Number.isInteger(noteCount) || noteCount < 0)) return NextResponse.json({ error: "Note count must be a non-negative integer." }, { status: 400 });
  if (length != null && (!Number.isInteger(length) || length < 0)) return NextResponse.json({ error: "Length must be a non-negative integer in milliseconds." }, { status: 400 });
  if (rhpOverride != null && (!Number.isInteger(rhpOverride) || rhpOverride < 1 || rhpOverride > 1000)) return NextResponse.json({ error: "RHP override must be between 1 and 1000." }, { status: 400 });

  if (category && !["jumps", "stream", "tech", "off_grid"].includes(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  if (category && (!Number.isInteger(categoryLevel) || categoryLevel! < 1 || categoryLevel! > 10)) return NextResponse.json({ error: "Category level must be between 1 and 10." }, { status: 400 });
  if (challengeLevel != null && (!Number.isInteger(challengeLevel) || challengeLevel < 1 || challengeLevel > 20)) return NextResponse.json({ error: "Challenge level must be between 1 and 20." }, { status: 400 });

  const rating = roundRating(requestedRating);
  const calculatedRhp = rhpGainForMap(rating, 100, null, rankIndexForRating(rating), length != null ? length / 1000 : null);

  try {
    await ensureRhpOverrideColumn();
    const map = await prisma.challengeMap.create({
      data: {
        title,
        artist,
        mapperName,
        mapFileUrl,
        requestedRating: rating,
        rating,
        noteCount,
        length,
        submittedById: admin.id,
        status: "approved",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        isAutoImported: false,
      },
    });

    await prisma.$executeRawUnsafe('UPDATE "ChallengeMap" SET "rhpOverride" = $1 WHERE "id" = $2', rhpOverride, map.id);

    if (challengeLevel != null) {
      await ensureChallengeLevelTable();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ChallengeMapLevel" ("id", "challengeMapId", "level", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("challengeMapId") DO UPDATE SET "level" = EXCLUDED."level", "updatedAt" = CURRENT_TIMESTAMP`,
        map.id,
        challengeLevel,
      );
    }

    if (category && categoryLevel != null) {
      await prisma.categoryMap.create({
        data: {
          category,
          level: categoryLevel,
          title,
          artist,
          mapFileUrl,
          mapperName,
          noteCount,
          length,
          submittedById: admin.id,
          status: "approved",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
    }

    await prisma.moderationAction.create({
      data: {
        actorId: admin.id,
        action: "admin_map_created",
        targetType: "challenge_map",
        targetId: map.id,
        metadata: { rating, calculatedRhp, rhpOverride, category, categoryLevel, challengeLevel },
      },
    });

    return NextResponse.json({ map, calculatedRhp, rhpOverride }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ error: "A map with that source ID already exists." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create the map." }, { status: 500 });
  }
}
