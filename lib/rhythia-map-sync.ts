import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { analysisIsCurrent, ensureMapAnalysisTable, getMapAnalysis, MAP_ANALYZER_VERSION, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";
import { resolveRhythiaMapSource } from "@/lib/rhythia-map-source";

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

const INT32_MIN = -0x80000000;
const INT32_MAX = 0x7fffffff;
const UINT32_MAX = 0xffffffff;
const UINT32_SIZE = 0x100000000;
const MAX_PAGES = 10000;

function sourceIdForDatabase(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error(`Rhythia map ID ${value} is not a safe integer.`);
  if (value >= INT32_MIN && value <= INT32_MAX) return value;
  if (value >= 0 && value <= UINT32_MAX) return value - UINT32_SIZE;
  throw new Error(`Rhythia map ID ${value} is outside the supported unsigned 32-bit range.`);
}

export function normalizeRhythiaSourceId(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(value);
  return sourceIdForDatabase(numeric);
}

function nullableInt32(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const integer = Math.trunc(numeric);
  return integer >= INT32_MIN && integer <= INT32_MAX ? integer : null;
}

function nullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
  if (!Number.isSafeInteger(id) || id <= 0 || id > UINT32_MAX) return null;

  const title = value.title ?? value.name ?? value.beatmapTitle;
  const beatmapFile = value.beatmapFile ?? value.downloadUrl ?? value.mapFileUrl ?? value.fileUrl;
  const image = value.image ?? value.imageUrl ?? value.coverUrl ?? value.cover ?? value.previewUrl ?? value.thumbnailUrl;
  const ownerUsername = value.ownerUsername ?? value.mapperName ?? value.authorUsername ?? value.author;

  return {
    id,
    title: typeof title === "string" ? title : null,
    starRating: nullableNumber(value.starRating ?? value.stars ?? value.rating ?? value.difficultyRating),
    difficulty: nullableNumber(value.difficulty),
    noteCount: nullableInt32(value.noteCount ?? value.notes ?? value.beatmapNotes),
    length: nullableInt32(value.length ?? value.duration ?? value.durationMs),
    playcount: nullableInt32(value.playcount),
    beatmapFile: typeof beatmapFile === "string" ? beatmapFile : null,
    image: typeof image === "string" ? image : null,
    mapHash: typeof value.mapHash === "string" ? value.mapHash : typeof value.hash === "string" ? value.hash : null,
    ownerUsername: typeof ownerUsername === "string" ? ownerUsername : null,
  };
}

async function fetchStatus(status: RhythiaMapStatus) {
  const apiStatus = status === "LEGACY" ? "APPROVED" : status;
  const maps: SyncedRhythiaMap[] = [];
  const seenIds = new Set<number>();
  let page = 1;
  let total: number | null = null;

  while (page <= MAX_PAGES) {
    const data = await rhythiaRequest<BeatmapResponse>("getBeatmaps", {
      status: apiStatus,
      page,
      minStars: 0,
      maxStars: 20,
      sort: "newest",
      sortDirection: "asc",
      session: "",
    });
    const pageMaps = asMapArray(data).map(normalizeMap).filter((map): map is SyncedRhythiaMap => map !== null);
    if (!pageMaps.length) break;

    let addedThisPage = 0;
    for (const map of pageMaps) {
      if (seenIds.has(map.id)) continue;
      seenIds.add(map.id);
      maps.push(map);
      addedThisPage += 1;
    }

    if (typeof data.total === "number" && Number.isFinite(data.total)) total = data.total;
    const hasExplicitEnd = data.hasNextPage === false || data.hasMore === false;
    const reachedTotal = total !== null && maps.length >= total;
    const reportedPages = typeof data.pages === "number" && Number.isFinite(data.pages) ? data.pages : null;
    if (reachedTotal || hasExplicitEnd || (reportedPages !== null && page >= reportedPages) || addedThisPage === 0) break;
    page += 1;
  }

  return maps;
}

function artistFromTitle(title: string) {
  const separator = title.indexOf(" - ");
  return separator > 0 ? title.slice(0, separator).trim() : null;
}

function mapPageUrl(id: number) {
  return `https://www.rhythia.com/maps/${id}`;
}

function absoluteAsset(value: string | null, base: string) {
  if (!value?.trim()) return null;
  try {
    return new URL(value.trim(), base).toString();
  } catch {
    return null;
  }
}

async function fillMissingAssets(rawMap: SyncedRhythiaMap) {
  const map = {
    ...rawMap,
    beatmapFile: absoluteAsset(rawMap.beatmapFile, "https://production.rhythia.com/"),
    image: absoluteAsset(rawMap.image, "https://production.rhythia.com/"),
  };
  if (map.beatmapFile && map.image) return map;

  try {
    const resolved = await resolveRhythiaMapSource(map.id);
    return {
      ...map,
      title: map.title ?? resolved.title,
      beatmapFile: map.beatmapFile || resolved.mapFileUrl,
      image: map.image || resolved.imageUrl,
      ownerUsername: map.ownerUsername ?? resolved.mapperName,
      noteCount: map.noteCount ?? nullableInt32(resolved.noteCount),
      length: map.length ?? nullableInt32(resolved.length),
    };
  } catch {
    return map;
  }
}

export async function syncRhythiaMaps(status?: RhythiaMapStatus) {
  await ensureMapAnalysisTable();
  const statuses: RhythiaMapStatus[] = status ? [status] : ["RANKED", "UNRANKED", "LEGACY"];
  const results = {
    ranked: 0,
    unranked: 0,
    legacy: 0,
    created: 0,
    updated: 0,
    promoted: 0,
    skipped: 0,
    failed: 0,
    directFiles: 0,
    previews: 0,
  };

  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) throw new Error("The rhythia-imports system user does not exist.");

  for (const currentStatus of statuses) {
    const maps = await fetchStatus(currentStatus);
    if (currentStatus === "RANKED") results.ranked = maps.length;
    else if (currentStatus === "UNRANKED") results.unranked = maps.length;
    else results.legacy = maps.length;

    for (const rawMap of maps) {
      try {
        const map = await fillMissingAssets(rawMap);
        const sourceBeatmapId = sourceIdForDatabase(map.id);
        if (sourceBeatmapId < INT32_MIN || sourceBeatmapId > INT32_MAX) throw new Error(`Normalized Rhythia map ID ${sourceBeatmapId} is outside PostgreSQL INTEGER range.`);

        const title = map.title?.trim() || `Rhythia map ${map.id}`;
        const sourceUrl = mapPageUrl(map.id);
        const mapFileUrl = map.beatmapFile?.trim() || sourceUrl;
        if (map.beatmapFile?.trim()) results.directFiles += 1;
        if (map.image?.trim()) results.previews += 1;

        const existing = await prisma.challengeMap.findUnique({
          where: { sourceBeatmapId },
          select: { id: true, status: true, isAutoImported: true, reviewerNote: true },
        });
        const isRanked = currentStatus === "RANKED";
        const isUnranked = currentStatus === "UNRANKED";
        const reviewerNote = isUnranked ? UNRANKED_MAP_MARKER : null;
        const existingAnalysis = existing ? await getMapAnalysis(existing.id) : null;
        const analyzedRating = analysisIsCurrent(existingAnalysis) ? existingAnalysis?.rating ?? null : null;

        if (!existing) {
          await prisma.challengeMap.create({
            data: {
              title,
              artist: artistFromTitle(title),
              description: null,
              mapFileUrl,
              imageUrl: map.image,
              requestedRating: 0,
              rating: null,
              mapperName: map.ownerUsername,
              noteCount: nullableInt32(map.noteCount),
              length: nullableInt32(map.length),
              sourceBeatmapId,
              sourceUrl,
              isAutoImported: true,
              submittedById: importer.id,
              status: currentStatus === "LEGACY" ? "legacy" : "approved",
              reviewerNote,
              reviewedById: importer.id,
              reviewedAt: new Date(),
            },
          });
          results.created += 1;
          continue;
        }

        if (!existing.isAutoImported) {
          results.skipped += 1;
          continue;
        }

        const updateData = {
          title,
          artist: artistFromTitle(title),
          mapFileUrl,
          imageUrl: map.image,
          requestedRating: analyzedRating ?? 0,
          rating: analyzedRating,
          mapperName: map.ownerUsername,
          noteCount: nullableInt32(map.noteCount),
          length: nullableInt32(map.length),
          sourceUrl,
        };

        if (currentStatus === "LEGACY") {
          await prisma.challengeMap.update({
            where: { id: existing.id },
            data: { ...updateData, status: "legacy", reviewerNote: null, reviewedById: importer.id, reviewedAt: new Date() },
          });
          await prisma.$executeRawUnsafe(
            `UPDATE "MapDifficultyAnalysis" SET "sourceStatus"='legacy',"pointEligible"=FALSE,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1`,
            existing.id,
          );
          results.updated += 1;
        } else if (isRanked) {
          await prisma.challengeMap.update({
            where: { id: existing.id },
            data: { ...updateData, status: "approved", reviewerNote: null, reviewedById: importer.id, reviewedAt: new Date() },
          });
          await prisma.$executeRawUnsafe(
            `UPDATE "MapDifficultyAnalysis" SET "sourceStatus"='ranked',"pointEligible"=CASE WHEN status='analyzed' AND "analyzerVersion"=$2 THEN TRUE ELSE FALSE END,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1`,
            existing.id,
            MAP_ANALYZER_VERSION,
          );
          results.promoted += 1;
        } else {
          await prisma.challengeMap.update({
            where: { id: existing.id },
            data: { ...updateData, status: "approved", reviewerNote: UNRANKED_MAP_MARKER, reviewedById: importer.id, reviewedAt: new Date() },
          });
          await prisma.$executeRawUnsafe(
            `UPDATE "MapDifficultyAnalysis" SET "sourceStatus"='unranked',"pointEligible"=FALSE,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1`,
            existing.id,
          );
          results.updated += 1;
        }
      } catch (error) {
        results.failed += 1;
        console.error("Rhythia map sync skipped one map", {
          status: currentStatus,
          sourceId: rawMap.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({
    where: { key: "rhythia_map_sync_last_run" },
    update: { value: now },
    create: { key: "rhythia_map_sync_last_run", value: now, description: "Last successful Rhythia ranked, unranked, and legacy map synchronization." },
  });
  if (status) {
    await prisma.siteSetting.upsert({
      where: { key: `rhythia_map_sync_last_${status.toLowerCase()}` },
      update: { value: now },
      create: {
        key: `rhythia_map_sync_last_${status.toLowerCase()}`,
        value: now,
        description: `Last successful Rhythia ${status.toLowerCase()} map synchronization.`,
      },
    });
  }

  return results;
}
