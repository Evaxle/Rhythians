import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canReviewMaps } from "@/lib/map-review";
import { prisma } from "@/lib/db";
import { reviewChallengeMap } from "@/lib/maps";
import { setMapSubmissionMetadata, getMapSubmissionMetadata, type ChallengePlacement } from "@/lib/map-submission-metadata";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await canReviewMaps(user))) return NextResponse.json({ error: "You are not a map reviewer." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as "approved" | "rejected" | undefined;
  if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  const note = typeof body?.note === "string" ? body.note : null;
  const placement = body?.challengePlacement as ChallengePlacement | null | undefined;
  const level = body?.challengeLevel == null ? null : Number(body.challengeLevel);

  try {
    const metadata = await getMapSubmissionMetadata(id);
    if (!metadata) return NextResponse.json({ error: "Map submission type is missing." }, { status: 400 });

    if (status === "approved" && metadata.submissionType === "challenge") {
      if (!["main", "jumps", "stream", "tech", "off_grid"].includes(String(placement))) return NextResponse.json({ error: "Choose a valid challenge destination." }, { status: 400 });
      if (!Number.isInteger(level) || level! < 1 || level! > 20) return NextResponse.json({ error: "Challenge level must be between 1 and 20." }, { status: 400 });

      const map = await prisma.challengeMap.findUnique({ where: { id } });
      if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

      if (placement === "main") {
        await prisma.$executeRawUnsafe('INSERT INTO "ChallengeMapLevel" ("id","challengeMapId","level","createdAt","updatedAt") VALUES ($1,$2,$3,NOW(),NOW()) ON CONFLICT ("challengeMapId") DO UPDATE SET "level"=EXCLUDED."level","updatedAt"=NOW()', crypto.randomUUID(), id, level);
      } else {
        await prisma.categoryMap.create({
          data: {
            category: placement,
            level,
            title: map.title,
            artist: map.artist,
            description: map.description,
            mapFileUrl: map.mapFileUrl,
            imageUrl: map.imageUrl,
            mapperName: map.mapperName,
            noteCount: map.noteCount,
            length: map.length,
            sourceBeatmapId: map.sourceBeatmapId,
            sourceUrl: map.sourceUrl,
            submittedById: map.submittedById,
            status: "approved",
            reviewerNote: note,
            reviewedById: user.id,
            reviewedAt: new Date(),
          },
        });
      }

      await setMapSubmissionMetadata(id, "challenge", placement!, level!);
      const updated = await reviewChallengeMap(id, user.id, status, null, note);
      return NextResponse.json({ map: updated, submissionType: "challenge", challengePlacement: placement, challengeLevel: level });
    }

    const updated = await reviewChallengeMap(id, user.id, status, null, note);
    if (status === "approved") await setMapSubmissionMetadata(id, "ranked", null, null);
    return NextResponse.json({ map: updated, submissionType: metadata.submissionType });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review this map." }, { status: 400 });
  }
}
