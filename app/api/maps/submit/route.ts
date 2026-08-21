import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submitChallengeMap } from "@/lib/maps";
import { checkRateLimit } from "@/lib/security";
import { parseRhythiaMapUrl } from "@/lib/rhythia";
import { fetchRhythiaMapById } from "@/lib/daily";
import { fairRatingFromStars } from "@/lib/ranks";
import { embedRhythiansId } from "@/lib/rhythkit-map-file";
import { setMapSubmissionMetadata, type MapSubmissionType } from "@/lib/map-submission-metadata";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
const bucket = () => process.env.STORAGE_BUCKET ?? "media";

function extensionFromPath(value: string) {
  const extension = value.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  return extension === "rhm" ? ".rhm" : extension === "sspm" ? ".sspm" : null;
}

function isAllowedRemoteHost(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "rhythia.net" || host.endsWith(".rhythia.net") || host === "rhythia.com" || host.endsWith(".rhythia.com") || host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

async function resolveMapFile(value: string) {
  const extension = extensionFromPath(value);
  if (!extension) throw new Error("Map file must be an .SSPM or .RHM file.");
  if (/^https?:\/\//i.test(value)) {
    if (!isAllowedRemoteHost(value)) throw new Error("Map file source is not allowed.");
    return { url: value, extension };
  }
  if (!supabaseAdmin) throw new Error("Storage service is not configured.");
  const { data, error } = await supabaseAdmin.storage.from(bucket()).createSignedUrl(value, 300);
  if (error || !data?.signedUrl) throw new Error("Map file is unavailable.");
  return { url: data.signedUrl, extension };
}

async function validateMapFile(value: string, mapId: string) {
  const source = await resolveMapFile(value);
  const response = await fetch(source.url, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error("Map file is unavailable.");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 50 * 1024 * 1024) throw new Error("Map file must be 50 MB or smaller.");
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > 50 * 1024 * 1024) throw new Error("Map file must be 50 MB or smaller.");
  const normalized = embedRhythiansId(data, source.extension, mapId);
  if (normalized.byteLength === 0) throw new Error("Map file could not be prepared for Rhythians.");
}

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
  }

  if (!resolvedTitle || resolvedTitle.length > 120) return NextResponse.json({ error: "Map title is required and must be under 120 characters." }, { status: 400 });
  if (!resolvedMapFile) return NextResponse.json({ error: "The map file could not be found." }, { status: 400 });
  if (!Number.isFinite(requestedRating) || requestedRating < 0 || requestedRating > 9.99) return NextResponse.json({ error: "The calculated rating is invalid." }, { status: 400 });

  const mapId = crypto.randomUUID();
  try {
    await validateMapFile(resolvedMapFile, mapId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The map file could not be prepared for Rhythians." }, { status: 422 });
  }

  let map;
  try {
    map = await submitChallengeMap({
      id: mapId,
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

  return NextResponse.json({ mapId: map.id, status: map.status, submissionType, requestedRating: map.requestedRating, downloadUrl: `/api/maps/download?id=${encodeURIComponent(map.id)}` });
}
