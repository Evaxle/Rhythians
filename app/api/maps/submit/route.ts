import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submitChallengeMap } from "@/lib/maps";
import { checkRateLimit } from "@/lib/security";
import { parseRhythiaMapUrl } from "@/lib/rhythia";
import { fetchRhythiaMapById } from "@/lib/daily";
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
  const { title, artist, description, mapFileUrl, imageUrl, requestedRating, mapperName, noteCount, length, rhythiaUrl } = body as {
    title?: string; artist?: string; description?: string; mapFileUrl?: string; imageUrl?: string;
    requestedRating?: number; mapperName?: string; noteCount?: number; length?: number; rhythiaUrl?: string;
  };

  const rating = submissionType === "challenge" ? 0 : Number(requestedRating);
  if (submissionType === "ranked" && (!Number.isFinite(rating) || rating < 0 || rating > 9.99)) return NextResponse.json({ error: "Requested rating must be between 0 and 9.99." }, { status: 400 });

  let sourceBeatmapId: number | null = null;
  let sourceUrl: string | null = null;
  let resolvedTitle = typeof title === "string" ? title : "";
  let resolvedArtist = typeof artist === "string" ? artist : null;
  let resolvedMapFile = typeof mapFileUrl === "string" && mapFileUrl.length > 0 ? mapFileUrl : "";
  let resolvedImage = typeof imageUrl === "string" && imageUrl.length > 0 ? imageUrl : null;
  let resolvedMapper = typeof mapperName === "string" ? mapperName : null;
  let resolvedNotes = Number.isFinite(noteCount) ? Number(noteCount) : null;
  let resolvedLength = Number.isFinite(length) ? Number(length) : null;
  const parsedMapUrl = typeof rhythiaUrl === "string" && rhythiaUrl.trim() ? parseRhythiaMapUrl(rhythiaUrl) : null;

  if (parsedMapUrl) {
    const fetched = await fetchRhythiaMapById(parsedMapUrl.id);
    if (!fetched) return NextResponse.json({ error: "That Rhythia map could not be found." }, { status: 404 });
    sourceBeatmapId = fetched.id;
    sourceUrl = parsedMapUrl.url;
    if (!resolvedTitle.trim()) resolvedTitle = fetched.title;
    const dash = fetched.title.indexOf(" - ");
    if (dash > 0) resolvedArtist = resolvedArtist ?? fetched.title.slice(0, dash).trim();
    resolvedMapFile = resolvedMapFile || fetched.downloadUrl || "";
    resolvedImage = resolvedImage ?? fetched.imageUrl;
    resolvedMapper = resolvedMapper ?? fetched.ownerUsername;
    resolvedNotes = resolvedNotes ?? fetched.noteCount;
    resolvedLength = resolvedLength ?? fetched.length;
  }

  if (!resolvedTitle.trim() || resolvedTitle.length > 120) return NextResponse.json({ error: "Title is required and must be under 120 characters." }, { status: 400 });
  if (!resolvedMapFile) return NextResponse.json({ error: "Provide a map file or a valid Rhythia map URL." }, { status: 400 });

  let map;
  try {
    map = await submitChallengeMap({
      title: resolvedTitle,
      artist: resolvedArtist,
      description: description ?? null,
      mapFileUrl: resolvedMapFile,
      imageUrl: resolvedImage,
      requestedRating: rating,
      mapperName: resolvedMapper,
      noteCount: resolvedNotes,
      length: resolvedLength,
      submittedById: user.id,
      sourceBeatmapId,
      sourceUrl,
    });
    await setMapSubmissionMetadata(map.id, submissionType);
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "This Rhythia map is already on the site. Browse it in the Maps section instead." }, { status: 409 });
    return NextResponse.json({ error: "Unable to submit this map. Please try again." }, { status: 500 });
  }

  await prisma.moderationAction.create({
    data: {
      actorId: user.id,
      action: submissionType === "challenge" ? "challenge_map_submitted" : "ranked_map_submitted",
      targetType: "map_submission",
      targetId: map.id,
      metadata: { title: map.title, submissionType, requestedRating: map.requestedRating, sourceUrl },
    },
  });

  return NextResponse.json({ mapId: map.id, status: map.status, submissionType });
}
