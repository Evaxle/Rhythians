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
  beatmaps?: SyncedRhythiaMap[];
};

async function fetchStatus(status: "RANKED" | "UNRANKED") {
  const maps: SyncedRhythiaMap[] = [];
  const seenIds = new Set<number>();
  let page = 1;
  let total: number | null = null;

  while (total === null || maps.length < total) {
    const data = await rhythiaRequest<BeatmapResponse>("getBeatmaps", { status, page, session: "" });
    const pageMaps = data.beatmaps ?? [];
    if (pageMaps.length === 0) break;

    let newMaps = 0;
    for (const map of pageMaps) {
      if (!map.id || seenIds.has(map.id)) continue;
      seenIds.add(map.id);
      maps.push(map);
      newMaps += 1;
    }

    if (typeof data.total === "number" && Number.isFinite(data.total)) total = data.total;
    if (newMaps === 0 || (total !== null && maps.length >= total)) break;
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

export async function syncRhythiaMaps(status?: "RANKED" | "UNRANKED") {
  const statuses = status ? [status] : ["RANKED", "UNRANKED"] as const;
  const results = { ranked: 0, unranked: 0, created: 0, updated: 0, promoted: 0, skipped: 0 };
  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) throw new Error("The rhythia-imports system user does not exist.");

  for (const currentStatus of statuses) {
    const maps = await fetchStatus(currentStatus);
    if (currentStatus === "RANKED") results.ranked = maps.length;
    else results.unranked = maps.length;

    for (const map of maps) {
      if (!map.id) {
        results.skipped += 1;
        continue;
      }

      const title = map.title?.trim() || `Rhythia map ${map.id}`;
      const sourceUrl = `https://www.rhythia.com/maps/${map.id}`;
      const mapFileUrl = map.beatmapFile?.trim() || sourceUrl;
      const rating = ratingForMap(map);
      const existing = await prisma.challengeMap.findUnique({ where: { sourceBeatmapId: map.id }, select: { id: true, status: true, isAutoImported: true } });

      if (!existing) {
        await prisma.challengeMap.create({ data: { title, artist: artistFromTitle(title), description: null, mapFileUrl, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.id, sourceUrl, isAutoImported: true, submittedById: importer.id, status: currentStatus === "RANKED" ? "approved" : "pending", reviewedById: currentStatus === "RANKED" ? importer.id : null, reviewedAt: currentStatus === "RANKED" ? new Date() : null } });
        results.created += 1;
        continue;
      }

      if (!existing.isAutoImported) {
        results.skipped += 1;
        continue;
      }

      if (currentStatus === "RANKED" && existing.status === "pending") {
        await prisma.challengeMap.update({ where: { id: existing.id }, data: { title, artist: artistFromTitle(title), mapFileUrl, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl, status: "approved", reviewedById: importer.id, reviewedAt: new Date() } });
        results.promoted += 1;
        continue;
      }

      await prisma.challengeMap.update({ where: { id: existing.id }, data: { title, artist: artistFromTitle(title), mapFileUrl, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl, status: currentStatus === "RANKED" ? "approved" : existing.status === "approved" ? "approved" : "pending" } });
      results.updated += 1;
    }
  }

  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({ where: { key: "rhythia_map_sync_last_run" }, update: { value: now }, create: { key: "rhythia_map_sync_last_run", value: now, description: "Last successful Rhythia ranked and unranked map synchronization." } });
  if (status) await prisma.siteSetting.upsert({ where: { key: `rhythia_map_sync_last_${status.toLowerCase()}` }, update: { value: now }, create: { key: `rhythia_map_sync_last_${status.toLowerCase()}`, value: now, description: `Last successful Rhythia ${status.toLowerCase()} map synchronization.` } });
  return results;
}
