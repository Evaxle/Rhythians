import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submitChallengeMap } from "@/lib/maps";
import { checkRateLimit } from "@/lib/security";
import { setMapSubmissionMetadata } from "@/lib/map-submission-metadata";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "map_submit", 10, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "You've submitted too many maps recently. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to submit maps." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const mapFileUrl = typeof body?.mapFileUrl === "string" ? body.mapFileUrl.trim() : "";

  if (!title || title.length > 120) return NextResponse.json({ error: "Map title is required and must be under 120 characters." }, { status: 400 });
  if (!artist || artist.length > 120) return NextResponse.json({ error: "Artist is required and must be under 120 characters." }, { status: 400 });
  if (!description || description.length > 2000) return NextResponse.json({ error: "Description is required and must be under 2000 characters." }, { status: 400 });
  if (!mapFileUrl) return NextResponse.json({ error: "Upload an .SSPM or .RHM map file." }, { status: 400 });
  if (!/\.(sspm|rhm)(?:$|[?#])/i.test(mapFileUrl)) return NextResponse.json({ error: "Map file must be an .SSPM or .RHM file." }, { status: 400 });

  let map;
  try {
    map = await submitChallengeMap({
      title,
      artist,
      description,
      mapFileUrl,
      imageUrl: null,
      requestedRating: 0,
      mapperName: null,
      noteCount: null,
      length: null,
      submittedById: user.id,
      sourceBeatmapId: null,
      sourceUrl: null,
      isAutoImported: false,
    });
    await setMapSubmissionMetadata(map.id, "ranked");
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "This map is already on the site." }, { status: 409 });
    return NextResponse.json({ error: "Unable to submit this map. Please try again." }, { status: 500 });
  }

  await prisma.moderationAction.create({
    data: {
      actorId: user.id,
      action: "ranked_map_submitted",
      targetType: "map_submission",
      targetId: map.id,
      metadata: { title: map.title, submissionType: "ranked" },
    },
  });

  return NextResponse.json({ mapId: map.id, status: map.status, submissionType: "ranked" });
}
