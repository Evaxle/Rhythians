import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canReviewMaps } from "@/lib/map-review";
import { prisma } from "@/lib/db";
import { reviewChallengeMap } from "@/lib/maps";
import { setMapSubmissionMetadata, getMapSubmissionMetadata, type ChallengePlacement } from "@/lib/map-submission-metadata";

const VALID_CHALLENGE_PLACEMENTS: ChallengePlacement[] = ["main", "jumps", "stream", "tech", "off_grid"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await canReviewMaps(user))) return NextResponse.json({ error: "You are not a map reviewer." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as "approved" | "rejected" | undefined;
  if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  const note = typeof body?.note === "string" ? body.note : null;
  const finalRatingValue = body?.finalRating == null ? null : Number(body.finalRating);
  if (status === "approved" && finalRatingValue != null && (!Number.isFinite(finalRatingValue) || finalRatingValue <= 0 || finalRatingValue > 9.99)) return NextResponse.json({ error: "Final rating must be between 0.1 and 9.99." }, { status: 400 });
  const placement = body?.challengePlacement as ChallengePlacement | null | undefined;
  const level = body?.challengeLevel == null ? null : Number(body.challengeLevel);
  try {
    const mapRecord = await prisma.challengeMap.findUnique({ where: { id }, select: { isAutoImported: true } });
    if (!mapRecord) return NextResponse.json({ error: "Map not found." }, { status: 404 });
    if (mapRecord.isAutoImported) return NextResponse.json({ error: "Rhythia auto-imported maps are reviewed automatically." }, { status: 400 });
    const metadata = await getMapSubmissionMetadata(id);
    if (!metadata) return NextResponse.json({ error: "Map submission type is missing." }, { status: 400 });
    if (status === "approved" && metadata.submissionType === "challenge") {
      if (!placement || !VALID_CHALLENGE_PLACEMENTS.includes(placement)) return NextResponse.json({ error: "Choose a valid challenge destination." }, { status: 400 });
      if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 20) return NextResponse.json({ error: "Challenge level must be between 1 and 20." }, { status: 400 });
      const challengePlacement: ChallengePlacement = placement;
      const challengeLevel: number = level;
      const map = await prisma.challengeMap.findUnique({ where: { id } });
      if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
      if (challengePlacement === "main") {
        await prisma.$executeRawUnsafe('INSERT INTO "ChallengeMapLevel" ("id","challengeMapId","level","createdAt","updatedAt") VALUES ($1,$2,$3,NOW(),NOW()) ON CONFLICT ("challengeMapId") DO UPDATE SET "level"=EXCLUDED."level","updatedAt"=NOW()', randomUUID(), id, challengeLevel);
      } else {
        await prisma.categoryMap.create({ data: { category: challengePlacement, level: challengeLevel, title: map.title, artist: map.artist, description: map.description, mapFileUrl: map.mapFileUrl, imageUrl: map.imageUrl, mapperName: map.mapperName, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.sourceBeatmapId, sourceUrl: map.sourceUrl, submittedById: map.submittedById, status: "approved", reviewerNote: note, reviewedById: user.id, reviewedAt: new Date() } });
      }
      await setMapSubmissionMetadata(id, "challenge", challengePlacement, challengeLevel);
      const updated = await reviewChallengeMap(id, user.id, status, null, note);
      return NextResponse.json({ map: updated, submissionType: "challenge", challengePlacement, challengeLevel });
    }
    const updated = await reviewChallengeMap(id, user.id, status, status === "approved" ? finalRatingValue : null, note);
    if (status === "approved") await setMapSubmissionMetadata(id, "ranked", null, null);
    return NextResponse.json({ map: updated, submissionType: metadata.submissionType });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review this map." }, { status: 400 });
  }
}
