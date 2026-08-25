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
const challengeCategories = new Set(["main_challenge", "jumps", "stream", "tech", "off_grid"]);

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

function parseRhythiansMapId(value: string) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/(?:maps?|map)\/([^/]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function findExistingByTitle(title: string) {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;
  const [challengeMaps, categoryMaps] = await Promise.all([
    prisma.challengeMap.findMany({ select: { id: true, title: true, status: true }, orderBy: { createdAt: "asc" } }),
    prisma.categoryMap.findMany({ select: { id: true, title: true, status: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return [...challengeMaps, ...categoryMaps].find((map) => normalizeTitle(map.title) === normalized) ?? null;
}

async function findExistingByRhythiaId(id: number) {
  const [challenge, category] = await Promise.all([
    prisma.challengeMap.findUnique({ where: { sourceBeatmapId: id }, select: { id: true, title: true, status: true } }),
    prisma.categoryMap.findUnique({ where: { sourceBeatmapId: id }, select: { id: true, title: true, status: true } }),
  ]);
  return challenge ?? category;
}

async function findExistingByRhythiansId(id: string) {
  const [challenge, category] = await Promise.all([
    prisma.challengeMap.findUnique({ where: { id }, select: { id: true, title: true, status: true } }),
    prisma.categoryMap.findUnique({ where: { id }, select: { id: true, title: true, status: true } }),
  ]);
  return challenge ?? category;
}

async function rejectDuplicate(title: string) {
  const existing = await findExistingByTitle(title);
  if (!existing) return null;
  return NextResponse.json({ error: `A map with the same name already exists: ${existing.title}. Please use the existing map instead of submitting a duplicate.` }, { status: 409 });
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
  const rhythiaUrl = typeof body?.rhythiaUrl === "string" ? body.rhythiaUrl.trim() : "";
  const rhythiansUrl = typeof body?.rhythiansUrl === "string" ? body.rhythiansUrl.trim() : "";
  const parsedMapUrl = rhythiaUrl ? parseRhythiaMapUrl(rhythiaUrl) : null;

  if (submissionType === "ranked") {
    if (!parsedMapUrl) return NextResponse.json({ error: "Submit a valid Rhythia map URL." }, { status: 400 });
    const existing = await findExistingByRhythiaId(parsedMapUrl.id);
    if (existing) return NextResponse.json({ error: `This Rhythia map has already been uploaded as ${existing.title}. It cannot be submitted again.` }, { status: 409 });
    const fetched = await fetchRhythiaMapById(parsedMapUrl.id);
    if (!fetched) return NextResponse.json({ error: "That Rhythia map could not be found." }, { status: 404 });
    if (!fetched.downloadUrl) return NextResponse.json({ error: "That Rhythia map does not have a downloadable map file." }, { status: 422 });
    const title = fetched.title?.trim() || "Untitled map";
    const duplicate = await rejectDuplicate(title);
    if (duplicate) return duplicate;
    const mapId = crypto.randomUUID();
    const dash = title.indexOf(" - ");
    const artist = dash > 0 ? title.slice(0, dash).trim() : null;
    const requestedRating = fairRatingFromStars(Number(fetched.starRating ?? 0));
    try {
      await validateMapFile(fetched.downloadUrl, mapId);
      const map = await submitChallengeMap({ id: mapId, title, artist, description: null, mapFileUrl: fetched.downloadUrl, imageUrl: fetched.imageUrl, requestedRating, mapperName: fetched.ownerUsername, noteCount: fetched.noteCount, length: fetched.length, submittedById: user.id, sourceBeatmapId: fetched.id, sourceUrl: parsedMapUrl.url, isAutoImported: true });
      await setMapSubmissionMetadata(map.id, submissionType);
      await prisma.moderationAction.create({ data: { actorId: user.id, action: "ranked_map_submitted", targetType: "map_submission", targetId: map.id, metadata: { title: map.title, submissionType, requestedRating: map.requestedRating, sourceUrl: parsedMapUrl.url, sourceBeatmapId: fetched.id } } });
      return NextResponse.json({ mapId: map.id, status: map.status, submissionType, requestedRating: map.requestedRating, downloadUrl: `/api/maps/download?id=${encodeURIComponent(map.id)}` });
    } catch (error: any) {
      if (error?.code === "P2002") return NextResponse.json({ error: "This map has already been submitted." }, { status: 409 });
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit this map." }, { status: 422 });
    }
  }

  const challengeCategory = typeof body?.challengeCategory === "string" ? body.challengeCategory : "";
  const requestedLevel = Number(body?.requestedLevel);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const mapFileUrl = typeof body?.mapFileUrl === "string" ? body.mapFileUrl.trim() : "";
  if (!challengeCategories.has(challengeCategory)) return NextResponse.json({ error: "Choose one of the five challenge categories." }, { status: 400 });
  if (!Number.isInteger(requestedLevel) || requestedLevel < 1 || requestedLevel > 10) return NextResponse.json({ error: "Requested level must be between 1 and 10." }, { status: 400 });
  if (!mapFileUrl && !parsedMapUrl && !rhythiansUrl) return NextResponse.json({ error: "Submit a Rhythia URL, Rhythians URL, or map file." }, { status: 400 });

  let resolvedTitle = title;
  let resolvedArtist: string | null = null;
  let resolvedDescription = description;
  let resolvedMapFile = mapFileUrl;
  let resolvedImage: string | null = null;
  let resolvedMapper: string | null = null;
  let resolvedNotes: number | null = null;
  let resolvedLength: number | null = null;
  let sourceBeatmapId: number | null = null;
  let sourceUrl: string | null = null;

  if (parsedMapUrl) {
    const existing = await findExistingByRhythiaId(parsedMapUrl.id);
    if (existing) return NextResponse.json({ error: `This Rhythia map has already been uploaded as ${existing.title}.` }, { status: 409 });
    const fetched = await fetchRhythiaMapById(parsedMapUrl.id);
    if (!fetched) return NextResponse.json({ error: "That Rhythia map could not be found." }, { status: 404 });
    sourceBeatmapId = fetched.id;
    sourceUrl = parsedMapUrl.url;
    resolvedTitle = fetched.title?.trim() || resolvedTitle;
    const dash = resolvedTitle.indexOf(" - ");
    resolvedArtist = dash > 0 ? resolvedTitle.slice(0, dash).trim() : null;
    resolvedMapFile = fetched.downloadUrl || resolvedMapFile;
    resolvedImage = fetched.imageUrl;
    resolvedMapper = fetched.ownerUsername;
    resolvedNotes = fetched.noteCount;
    resolvedLength = fetched.length;
  } else if (rhythiansUrl) {
    const id = parseRhythiansMapId(rhythiansUrl);
    if (!id) return NextResponse.json({ error: "Submit a valid Rhythians map URL." }, { status: 400 });
    const existing = await findExistingByRhythiansId(id);
    if (existing) return NextResponse.json({ error: `This Rhythians map has already been uploaded as ${existing.title}.` }, { status: 409 });
    return NextResponse.json({ error: "A Rhythians URL can only reference an existing map. Choose a different map source." }, { status: 409 });
  }

  if (!resolvedTitle || resolvedTitle.length > 120) return NextResponse.json({ error: "Map title is required and must be under 120 characters." }, { status: 400 });
  const duplicate = await rejectDuplicate(resolvedTitle);
  if (duplicate) return duplicate;
  if (!resolvedMapFile) return NextResponse.json({ error: "The map file could not be found." }, { status: 400 });
  const mapId = crypto.randomUUID();
  try {
    await validateMapFile(resolvedMapFile, mapId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The map file could not be prepared for Rhythians." }, { status: 422 });
  }

  try {
    if (challengeCategory === "main_challenge") {
      const map = await submitChallengeMap({ id: mapId, title: resolvedTitle, artist: resolvedArtist, description: resolvedDescription, mapFileUrl: resolvedMapFile, imageUrl: resolvedImage, requestedRating: 0, mapperName: resolvedMapper, noteCount: resolvedNotes, length: resolvedLength, submittedById: user.id, sourceBeatmapId, sourceUrl, isAutoImported: false });
      await setMapSubmissionMetadata(map.id, "challenge", "main", requestedLevel);
      await prisma.moderationAction.create({ data: { actorId: user.id, action: "challenge_map_submitted", targetType: "map_submission", targetId: map.id, metadata: { title: map.title, submissionType, challengeCategory, requestedLevel, sourceUrl, sourceBeatmapId } } });
      return NextResponse.json({ mapId: map.id, status: map.status, challengeCategory, requestedLevel });
    }
    const placement = challengeCategory as "jumps" | "stream" | "tech" | "off_grid";
    const map = await prisma.categoryMap.create({ data: { id: mapId, category: placement, level: requestedLevel, title: resolvedTitle, artist: resolvedArtist, description: resolvedDescription, mapFileUrl: resolvedMapFile, imageUrl: resolvedImage, mapperName: resolvedMapper, noteCount: resolvedNotes, length: resolvedLength, submittedById: user.id, sourceBeatmapId, sourceUrl } });
    await setMapSubmissionMetadata(map.id, "challenge", placement, requestedLevel);
    await prisma.moderationAction.create({ data: { actorId: user.id, action: "category_map_submitted", targetType: "category_map_submission", targetId: map.id, metadata: { title: map.title, submissionType, challengeCategory, requestedLevel, sourceUrl, sourceBeatmapId } } });
    return NextResponse.json({ mapId: map.id, status: map.status, challengeCategory, requestedLevel });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "This map has already been uploaded and cannot be submitted again." }, { status: 409 });
    return NextResponse.json({ error: "Unable to submit this map. Please try again." }, { status: 500 });
  }
}