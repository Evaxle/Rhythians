import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submitChallengeMap } from "@/lib/maps";
import { checkRateLimit } from "@/lib/security";
import { parseRhythiaMapUrl } from "@/lib/rhythia";
import { fetchRhythiaMapById } from "@/lib/daily";
import { fairRatingFromStars } from "@/lib/ranks";
import { setMapSubmissionMetadata, type MapSubmissionType } from "@/lib/map-submission-metadata";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "map_submit", 10, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "You've submitted too many maps recently. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to submit maps." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const submissionType: MapSubmissionType = body?.submissionType === "challenge" ? "challenge" : "ranked";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const mapFileUrl = typeof body?.mapFileUrl === "string" ? body.mapFileUrl.trim() : "";
  const rhythiaUrl = typeof body?.rhythiaUrl === "string" ? body.rhythiaUrl.trim() : "";
  const parsedMapUrl = rhythiaUrl ? parseRhythiaMapUrl(rhythiaUrl) : null;
  const fileRating = typeof body?.requestedRating === "number" ? body.requestedRating : Number(body?.requestedRating);

  if (submissionType === "challenge") return NextResponse.json({ error: "Challenge submissions are not handled by this ranked form." }, { status: 400 });

  let resolvedTitle = title;
  let resolvedArtist = artist || null;
  let resolvedDescription = description || null;
  let resolvedMapFile = mapFileUrl;
  let resolvedImage: string | null = null;
  let resolvedMapper: string | null = null;
  let resolvedNotes: number | null = null;
  let resolvedLength: number | null = null;
  let sourceBeatmapId: number | null = null;
  let sourceUrl: string | null = null;
  let requestedRating = fileRating;
  let isAutoImported = false;

  if (parsedMapUrl) {
    const fetched = await fetchRhythiaMapById(parsedMapUrl.id);
    if (!fetched) return NextResponse.json({ error: "That Rhythia map could not be found." }, { status: 404 });
    sourceBeatmapId = fetched.id;
    sourceUrl = parsedMapUrl.url;
    resolvedTitle = fetched.title?.trim() || resolvedTitle;
    const dash = resolvedTitle.indexOf(" - ");
    resolvedArtist = resolvedArtist ?? (dash > 0 ? resolvedTitle.slice(0, dash).trim() : null);
    resolvedMapFile = fetched.downloadUrl || resolvedMapFile;
    resolvedImage = fetched.imageUrl;
    resolvedMapper = fetched.ownerUsername;
    resolvedNotes = fetched.noteCount;
    resolvedLength = fetched.length;
    requestedRating = fairRatingFromStars(Number(fetched.starRating ?? 0));
    isAutoImported = true;
  } else {
    if (!resolvedTitle || resolvedTitle.length > 120) return NextResponse.json({ error: "Map title is required and must be under 120 characters." }, { status: 400 });
    if (!resolvedArtist || resolvedArtist.length > 120) return NextResponse.json({ error: "Artist is required and must be under 120 characters." }, { status: 400 });
    if (!resolvedDescription || resolvedDescription.length > 2000) return NextResponse.json({ error: "Description is required and must be under 2000 characters." }, { status: 400 });
    if (!Number.isFinite(requestedRating) || requestedRating <= 0 || requestedRating > 9.99) return NextResponse.json({ error: "Requested rating must be between 0.1 and 9.99." }, { status: 400 });
    if (!resolvedMapFile) return NextResponse.json({ error: "Upload an .SSPM or .RHM map file." }, { status: 400 });
    if (!/\.(sspm|rhm)(?:$|[?#])/i.test(resolvedMapFile)) return NextResponse.json({ error: "Map file must be an .SSPM or .RHM file." }, { status: 400 });
  }

  if (!resolvedTitle || resolvedTitle.length > 120) return NextResponse.json({ error: "Map title is required and must be under 120 characters." }, { status: 400 });
  if (!resolvedMapFile) return NextResponse.json({ error: "The map file could not be found." }, { status: 400 });
  if (!Number.isFinite(requestedRating) || requestedRating < 0 || requestedRating > 9.99) return NextResponse.json({ error: "The calculated rating is invalid." }, { status: 400 });

  let map;
  try {
    map = await submitChallengeMap({
      title: resolvedTitle,
      artist: resolvedArtist,
      description: resolvedDescription,
      mapFileUrl: resolvedMapFile,
      imageUrl: resolvedImage,
      requestedRating,
      mapperName: resolvedMapper,
      noteCount: resolvedNotes,
      length: resolvedLength,
      submittedById: user.id,
      sourceBeatmapId,
      sourceUrl,
      isAutoImported,
    });
    await setMapSubmissionMetadata(map.id, submissionType);
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
      metadata: { title: map.title, submissionType, requestedRating: map.requestedRating, sourceUrl },
    },
  });

  return NextResponse.json({ mapId: map.id, status: map.status, submissionType, requestedRating: map.requestedRating });
}
