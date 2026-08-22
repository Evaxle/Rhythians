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

export async function syncRhythiaMaps() {
  const [ranked, unranked] = await Promise.all([fetchStatus("RANKED"), fetchStatus("UNRANKED")]);
  const seen = new Map<number, { map: SyncedRhythiaMap; ranked: boolean }>();
  for (const map of unranked) seen.set(map.id, { map, ranked: false });
  for (const map of ranked) seen.set(map.id, { map, ranked: true });

  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) throw new Error("The rhythia-imports system user does not exist.");

  let created = 0;
  let updated = 0;
  let promoted = 0;
  let skipped = 0;

  for (const { map, ranked: isRanked } of seen.values()) {
    if (!map.id) {
      skipped += 1;
      continue;
    }

    const title = map.title?.trim() || `Rhythia map ${map.id}`;
    const sourceUrl = `https://www.rhythia.com/maps/${map.id}`;
    const mapFileUrl = map.beatmapFile?.trim() || sourceUrl;
    const rating = ratingForMap(map);
    const existing = await prisma.challengeMap.findUnique({ where: { sourceBeatmapId: map.id }, select: { id: true, status: true, isAutoImported: true } });

    if (!existing) {
      await prisma.challengeMap.create({ data: { title, artist: artistFromTitle(title), description: null, mapFileUrl, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.id, sourceUrl, isAutoImported: true, submittedById: importer.id, status: isRanked ? "approved" : "pending", reviewedById: isRanked ? importer.id : null, reviewedAt: isRanked ? new Date() : null } });
      created += 1;
      continue;
    }

    if (!existing.isAutoImported) {
      skipped += 1;
      continue;
    }

    if (isRanked && existing.status === "pending") {
      await prisma.challengeMap.update({ where: { id: existing.id }, data: { title, artist: artistFromTitle(title), mapFileUrl, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl, status: "approved", reviewedById: importer.id, reviewedAt: new Date() } });
      promoted += 1;
      continue;
    }

    await prisma.challengeMap.update({ where: { id: existing.id }, data: { title, artist: artistFromTitle(title), mapFileUrl, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl } });
    updated += 1;
  }

  await prisma.siteSetting.upsert({ where: { key: "rhythia_map_sync_last_run" }, update: { value: new Date().toISOString() }, create: { key: "rhythia_map_sync_last_run", value: new Date().toISOString(), description: "Last successful Rhythia ranked and unranked map synchronization." } });
  return { ranked: ranked.length, unranked: unranked.length, created, updated, promoted, skipped };
}
