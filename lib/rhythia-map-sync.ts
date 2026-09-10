import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { analysisIsCurrent, ensureMapAnalysisTable, getMapAnalysis, MAP_ANALYZER_VERSION, UNRANKED_MAP_MARKER } from "@/lib/map-analysis-store";
import { resolveRhythiaMapSource } from "@/lib/rhythia-map-source";

export type SyncedRhythiaMap = { id: number; title: string | null; starRating: number | null; difficulty: number | null; noteCount: number | null; length: number | null; playcount: number | null; beatmapFile: string | null; image: string | null; mapHash: string | null; ownerUsername: string | null };
type BeatmapResponse = { total?: number; count?: number; pages?: number; page?: number; hasNextPage?: boolean; hasMore?: boolean; beatmaps?: unknown; maps?: unknown; data?: unknown };
type RhythiaMapStatus = "RANKED" | "UNRANKED" | "LEGACY";
const MAX_RHYTHIA_SOURCE_ID = 0xffffffff;
const SIGNED_INT_OFFSET = 0x100000000;
const MAX_PAGES = 10000;

function sourceIdForDatabase(id: number) { if (!Number.isSafeInteger(id) || id < 0 || id > MAX_RHYTHIA_SOURCE_ID) throw new Error(`Rhythia map ID ${id} is outside the supported 32-bit unsigned range.`); return id > 0x7fffffff ? id - SIGNED_INT_OFFSET : id; }
export function normalizeRhythiaSourceId(value: string | number) { return sourceIdForDatabase(typeof value === "number" ? value : Number(value)); }
function asMapArray(value: unknown): SyncedRhythiaMap[] { if (Array.isArray(value)) return value as SyncedRhythiaMap[]; if (!value || typeof value !== "object") return []; const record = value as Record<string, unknown>; for (const key of ["beatmaps", "maps", "items", "results", "data"]) if (Array.isArray(record[key])) return record[key] as SyncedRhythiaMap[]; return []; }
function normalizeMap(raw: SyncedRhythiaMap): SyncedRhythiaMap | null { const value = raw as unknown as Record<string, unknown>; const id = Number(value.id ?? value.mapId ?? value.beatmapId); if (!Number.isSafeInteger(id) || id <= 0) return null; const title = value.title ?? value.name ?? value.beatmapTitle; const stars = value.starRating ?? value.stars ?? value.rating ?? value.difficultyRating; const noteCount = value.noteCount ?? value.notes ?? value.beatmapNotes; const length = value.length ?? value.duration ?? value.durationMs; const beatmapFile = value.beatmapFile ?? value.downloadUrl ?? value.mapFileUrl ?? value.fileUrl; const image = value.image ?? value.imageUrl ?? value.coverUrl ?? value.cover ?? value.previewUrl ?? value.thumbnailUrl; const ownerUsername = value.ownerUsername ?? value.mapperName ?? value.authorUsername ?? value.author; return { id, title: typeof title === "string" ? title : null, starRating: stars == null ? null : Number(stars), difficulty: value.difficulty == null ? null : Number(value.difficulty), noteCount: noteCount == null ? null : Number(noteCount), length: length == null ? null : Number(length), playcount: value.playcount == null ? null : Number(value.playcount), beatmapFile: typeof beatmapFile === "string" ? beatmapFile : null, image: typeof image === "string" ? image : null, mapHash: typeof value.mapHash === "string" ? value.mapHash : typeof value.hash === "string" ? value.hash : null, ownerUsername: typeof ownerUsername === "string" ? ownerUsername : null }; }
async function fetchStatus(status: RhythiaMapStatus) { const apiStatus = status === "LEGACY" ? "APPROVED" : status; const maps: SyncedRhythiaMap[] = []; const seenIds = new Set<number>(); let page = 1; let total: number | null = null; while (page <= MAX_PAGES) { const data = await rhythiaRequest<BeatmapResponse>("getBeatmaps", { status: apiStatus, page, minStars: 0, maxStars: 20, sort: "newest", sortDirection: "asc", session: "" }); const pageMaps = asMapArray(data).map(normalizeMap).filter((map): map is SyncedRhythiaMap => map !== null); if (!pageMaps.length) break; let addedThisPage = 0; for (const map of pageMaps) { if (seenIds.has(map.id)) continue; seenIds.add(map.id); maps.push(map); addedThisPage += 1; } if (typeof data.total === "number" && Number.isFinite(data.total)) total = data.total; const hasExplicitEnd = data.hasNextPage === false || data.hasMore === false; const reachedTotal = total !== null && maps.length >= total; const reportedPages = typeof data.pages === "number" && Number.isFinite(data.pages) ? data.pages : null; if (reachedTotal || hasExplicitEnd || (reportedPages !== null && page >= reportedPages) || addedThisPage === 0) break; page += 1; } return maps; }
function artistFromTitle(title: string) { const separator = title.indexOf(" - "); return separator > 0 ? title.slice(0, separator).trim() : null; }
function mapPageUrl(id: number) { return `https://www.rhythia.com/maps/${id}`; }
function absoluteAsset(value: string | null, base: string) { if (!value?.trim()) return null; try { return new URL(value.trim(), base).toString(); } catch { return null; } }
async function fillMissingAssets(rawMap: SyncedRhythiaMap) {
  const map = { ...rawMap, beatmapFile: absoluteAsset(rawMap.beatmapFile, "https://production.rhythia.com/"), image: absoluteAsset(rawMap.image, "https://production.rhythia.com/") };
  if (map.beatmapFile && map.image) return map;
  try {
    const resolved = await resolveRhythiaMapSource(map.id);
    return { ...map, title: map.title ?? resolved.title, beatmapFile: map.beatmapFile || resolved.mapFileUrl, image: map.image || resolved.imageUrl, ownerUsername: map.ownerUsername ?? resolved.mapperName, noteCount: map.noteCount ?? resolved.noteCount, length: map.length ?? resolved.length };
  } catch { return map; }
}

export async function syncRhythiaMaps(status?: RhythiaMapStatus) {
  await ensureMapAnalysisTable();
  const statuses: RhythiaMapStatus[] = status ? [status] : ["RANKED", "UNRANKED", "LEGACY"];
  const results = { ranked: 0, unranked: 0, legacy: 0, created: 0, updated: 0, promoted: 0, skipped: 0, failed: 0, directFiles: 0, previews: 0 };
  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) throw new Error("The rhythia-imports system user does not exist.");
  for (const currentStatus of statuses) {
    const maps = await fetchStatus(currentStatus);
    if (currentStatus === "RANKED") results.ranked = maps.length; else if (currentStatus === "UNRANKED") results.unranked = maps.length; else results.legacy = maps.length;
    for (const rawMap of maps) {
      const map = await fillMissingAssets(rawMap);
      let sourceBeatmapId: number;
      try { sourceBeatmapId = sourceIdForDatabase(map.id); } catch { results.failed += 1; continue; }
      const title = map.title?.trim() || `Rhythia map ${map.id}`;
      const sourceUrl = mapPageUrl(map.id);
      const mapFileUrl = map.beatmapFile?.trim() || sourceUrl;
      if (map.beatmapFile?.trim()) results.directFiles += 1;
      if (map.image?.trim()) results.previews += 1;
      const existing = await prisma.challengeMap.findUnique({ where: { sourceBeatmapId }, select: { id: true, status: true, isAutoImported: true, reviewerNote: true } });
      const isRanked = currentStatus === "RANKED";
      const isUnranked = currentStatus === "UNRANKED";
      const reviewerNote = isUnranked ? UNRANKED_MAP_MARKER : null;
      const existingAnalysis = existing ? await getMapAnalysis(existing.id) : null;
      const analyzedRating = analysisIsCurrent(existingAnalysis) ? existingAnalysis?.rating ?? null : null;
      if (!existing) {
        await prisma.challengeMap.create({ data: { title, artist: artistFromTitle(title), description: null, mapFileUrl, imageUrl: map.image, requestedRating: 0, rating: null, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceBeatmapId, sourceUrl, isAutoImported: true, submittedById: importer.id, status: currentStatus === "LEGACY" ? "legacy" : "approved", reviewerNote, reviewedById: importer.id, reviewedAt: new Date() } });
        results.created += 1;
        continue;
      }
      if (!existing.isAutoImported) { results.skipped += 1; continue; }
      const updateData = { title, artist: artistFromTitle(title), mapFileUrl, imageUrl: map.image, requestedRating: analyzedRating ?? 0, rating: analyzedRating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl };
      if (currentStatus === "LEGACY") {
        await prisma.challengeMap.update({ where: { id: existing.id }, data: { ...updateData, status: "legacy", reviewerNote: null, reviewedById: importer.id, reviewedAt: new Date() } });
        await prisma.$executeRawUnsafe(`UPDATE "MapDifficultyAnalysis" SET "sourceStatus"='legacy',"pointEligible"=FALSE,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1`, existing.id);
        results.updated += 1;
      } else if (isRanked) {
        await prisma.challengeMap.update({ where: { id: existing.id }, data: { ...updateData, status: "approved", reviewerNote: null, reviewedById: importer.id, reviewedAt: new Date() } });
        await prisma.$executeRawUnsafe(`UPDATE "MapDifficultyAnalysis" SET "sourceStatus"='ranked',"pointEligible"=CASE WHEN status='analyzed' AND "analyzerVersion"=$2 THEN TRUE ELSE FALSE END,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1`, existing.id, MAP_ANALYZER_VERSION);
        results.promoted += 1;
      } else {
        await prisma.challengeMap.update({ where: { id: existing.id }, data: { ...updateData, status: "approved", reviewerNote: UNRANKED_MAP_MARKER, reviewedById: importer.id, reviewedAt: new Date() } });
        await prisma.$executeRawUnsafe(`UPDATE "MapDifficultyAnalysis" SET "sourceStatus"='unranked',"pointEligible"=FALSE,"updatedAt"=CURRENT_TIMESTAMP WHERE "mapId"=$1`, existing.id);
        results.updated += 1;
      }
    }
  }
  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({ where: { key: "rhythia_map_sync_last_run" }, update: { value: now }, create: { key: "rhythia_map_sync_last_run", value: now, description: "Last successful Rhythia ranked, unranked, and legacy map synchronization." } });
  if (status) await prisma.siteSetting.upsert({ where: { key: `rhythia_map_sync_last_${status.toLowerCase()}` }, update: { value: now }, create: { key: `rhythia_map_sync_last_${status.toLowerCase()}`, value: now, description: `Last successful Rhythia ${status.toLowerCase()} map synchronization.` } });
  return results;
}
