import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { fairRatingFromStars } from "@/lib/ranks";

export type SyncedRhythiaMap = {
  id: number;
  title: string | null;
  starRating: number | null;
  difficulty: number | null;
  noteCount: number | null;
  length: number | null;
  playcount: number | null;
  beatmapFile: string | null;
  image: string | null;
  mapHash: string | null;
  ownerUsername: string | null;
};

type BeatmapResponse = {
  total?: number;
  count?: number;
  pages?: number;
  page?: number;
  hasNextPage?: boolean;
  hasMore?: boolean;
  beatmaps?: unknown;
  maps?: unknown;
  data?: unknown;
};
type RhythiaMapStatus = "RANKED" | "UNRANKED" | "LEGACY";

const MAX_RHYTHIA_SOURCE_ID = 0xffffffff;
const SIGNED_INT_OFFSET = 0x100000000;
const RHYTHIA_PAGE_SIZE = 100;
const MAX_PAGES = 10000;

function sourceIdForDatabase(id: number) {
  if (!Number.isSafeInteger(id) || id < 0 || id > MAX_RHYTHIA_SOURCE_ID) throw new Error(`Rhythia map ID ${id} is outside the supported 32-bit unsigned range.`);
  return id > 0x7fffffff ? id - SIGNED_INT_OFFSET : id;
}

export function normalizeRhythiaSourceId(value: string | number) {
  return sourceIdForDatabase(typeof value === "number" ? value : Number(value));
}

function asMapArray(value: unknown): SyncedRhythiaMap[] {
  if (Array.isArray(value)) return value as SyncedRhythiaMap[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["beatmaps", "maps", "items", "results", "data"]) {
    if (Array.isArray(record[key])) return record[key] as SyncedRhythiaMap[];
  }
  return [];
}

function normalizeMap(raw: SyncedRhythiaMap): SyncedRhythiaMap | null {
  const value = raw as unknown as Record<string, unknown>;
  const id = Number(value.id ?? value.mapId ?? value.beatmapId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const title = value.title ?? value.name ?? value.beatmapTitle;
  const stars = value.starRating ?? value.stars ?? value.rating ?? value.difficultyRating;
  const noteCount = value.noteCount ?? value.notes ?? value.beatmapNotes;
  const length = value.length ?? value.duration ?? value.durationMs;
  const beatmapFile = value.beatmapFile ?? value.downloadUrl ?? value.mapFileUrl ?? value.fileUrl;
  const image = value.image ?? value.imageUrl ?? value.coverUrl ?? value.cover;
  const ownerUsername = value.ownerUsername ?? value.mapperName ?? value.authorUsername ?? value.author;

  return {
    id,
    title: typeof title === "string" ? title : null,
    starRating: stars == null ? null : Number(stars),
    difficulty: value.difficulty == null ? null : Number(value.difficulty),
    noteCount: noteCount == null ? null : Number(noteCount),
    length: length == null ? null : Number(length),
    playcount: value.playcount == null ? null : Number(value.playcount),
    beatmapFile: typeof beatmapFile === "string" ? beatmapFile : null,
    image: typeof image === "string" ? image : null,
    mapHash: typeof value.mapHash === "string" ? value.mapHash : typeof value.hash === "string" ? value.hash : null,
    ownerUsername: typeof ownerUsername === "string" ? ownerUsername : null,
  };
}

async function fetchStatus(status: RhythiaMapStatus) {
  // Rhythia's public maps page uses APPROVED for the legacy-map source. The
  // local "legacy" status is intentionally different from Rhythia's API status.
  const apiStatus = status === "LEGACY" ? "APPROVED" : status;
  const maps: SyncedRhythiaMap[] = [];
  const seenIds = new Set<number>();
  let page = 1;
  let total: number | null = null;

  while (page <= MAX_PAGES) {
    const data = await rhythiaRequest<BeatmapResponse>("getBeatmaps", {
      status: apiStatus,
      page,
      limit: RHYTHIA_PAGE_SIZE,
      minStars: 0,
      maxStars: 20,
      sort: "newest",
      sortDirection: "asc",
      session: "",
    });

    const pageMaps = asMapArray(data).map(normalizeMap).filter((map): map is SyncedRhythiaMap => map !== null);
    if (pageMaps.length === 0) break;

    let addedThisPage = 0;
    for (const map of pageMaps) {
      if (seenIds.has(map.id)) continue;
      seenIds.add(map.id);
      maps.push(map);
      addedThisPage += 1;
    }

    if (typeof data.total === "number" && Number.isFinite(data.total)) total = data.total;

    const hasExplicitMore = data.hasNextPage === true || data.hasMore === true;
    const hasExplicitEnd = data.hasNextPage === false || data.hasMore === false;
    const reachedTotal = total !== null && maps.length >= total;
    const reportedPages = typeof data.pages === "number" && Number.isFinite(data.pages) ? data.pages : null;
    const reachedReportedPages = reportedPages !== null && page >= reportedPages;

    if (reachedTotal || hasExplicitEnd || reachedReportedPages) break;
    // If the API does not expose pagination metadata, a short page is the
    // normal end-of-results signal. Otherwise continue until the explicit
    // pagination metadata says we are done.
    if (!hasExplicitMore && total === null && reportedPages === null && pageMaps.length < RHYTHIA_PAGE_SIZE) break;
    // Protect against an API that ignores page/limit and keeps returning the
    // same page forever.
    if (addedThisPage === 0) break;

    page += 1;
  }

  return maps;
}

function artistFromTitle(title: string) {
  const separator = title.indexOf(" - ");
  return separator > 0 ? title.slice(0, separator).trim() : null;
}

function ratingForMap(map: SyncedRhythiaMap) {
  return fairRatingFromStars(Number.isFinite(map.starRating ?? NaN) ? map.starRating ?? 0 : 0);
}

export async function syncRhythiaMaps(status?: RhythiaMapStatus) {
  const statuses: RhythiaMapStatus[] = status ? [status] : ["RANKED", "UNRANKED", "LEGACY"];
  const results = { ranked: 0, unranked: 0, legacy: 0, created: 0, updated: 0, promoted: 0, skipped: 0, failed: 0 };
  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) throw new Error("The rhythia-imports system user does not exist.");

  for (const currentStatus of statuses) {
    const maps = await fetchStatus(currentStatus);
    if (currentStatus === "RANKED") results.ranked = maps.length;
    else if (currentStatus === "UNRANKED") results.unranked = maps.length;
    else results.legacy = maps.length;

    for (const map of maps) {
      let sourceBeatmapId: number;
      try { sourceBeatmapId = sourceIdForDatabase(map.id); } catch { results.failed += 1; continue; }

      const title = map.title?.trim() || `Rhythia map ${map.id}`;
      const sourceUrl = `https://www.rhythia.com/maps/${map.id}`;
      const mapFileUrl = map.beatmapFile?.trim() || sourceUrl;
      const rating = ratingForMap(map);
      const existing = await prisma.challengeMap.findUnique({ where: { sourceBeatmapId }, select: { id: true, status: true, isAutoImported: true } });

      if (!existing) {
        await prisma.challengeMap.create({
          data: {
            title,
            artist: artistFromTitle(title),
            description: null,
            mapFileUrl,
            imageUrl: map.image,
            requestedRating: rating,
            rating,
            mapperName: map.ownerUsername,
            noteCount: map.noteCount,
            length: map.length,
            sourceBeatmapId,
            sourceUrl,
            isAutoImported: true,
            submittedById: importer.id,
            status: currentStatus === "RANKED" ? "approved" : currentStatus === "LEGACY" ? "legacy" : "pending",
            reviewedById: currentStatus === "UNRANKED" ? null : importer.id,
            reviewedAt: currentStatus === "UNRANKED" ? null : new Date(),
          },
        });
        results.created += 1;
        continue;
      }

      if (!existing.isAutoImported) { results.skipped += 1; continue; }

      const updateData = { title, artist: artistFromTitle(title), mapFileUrl, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl };
      if (currentStatus === "LEGACY") {
        await prisma.challengeMap.update({ where: { id: existing.id }, data: { ...updateData, status: "legacy", reviewedById: importer.id, reviewedAt: new Date() } });
        results.updated += 1;
      } else if (currentStatus === "RANKED" && existing.status === "pending") {
        await prisma.challengeMap.update({ where: { id: existing.id }, data: { ...updateData, status: "approved", reviewedById: importer.id, reviewedAt: new Date() } });
        results.promoted += 1;
      } else {
        await prisma.challengeMap.update({ where: { id: existing.id }, data: { ...updateData, status: currentStatus === "RANKED" ? "approved" : existing.status === "approved" ? "approved" : "pending" } });
        results.updated += 1;
      }
    }
  }

  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({ where: { key: "rhythia_map_sync_last_run" }, update: { value: now }, create: { key: "rhythia_map_sync_last_run", value: now, description: "Last successful Rhythia ranked, unranked, and legacy map synchronization." } });
  if (status) await prisma.siteSetting.upsert({ where: { key: `rhythia_map_sync_last_${status.toLowerCase()}` }, update: { value: now }, create: { key: `rhythia_map_sync_last_${status.toLowerCase()}`, value: now, description: `Last successful Rhythia ${status.toLowerCase()} map synchronization.` } });
  return results;
}
