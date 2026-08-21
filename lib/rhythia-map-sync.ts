import { prisma } from "@/lib/db";
import { rhythiaRequest } from "@/lib/rhythia";
import { fairRatingFromStars } from "@/lib/ranks";

export type SyncedRhythiaMap = {
  id: number;
  title: string;
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

async function fetchStatus(status: "RANKED" | "UNRANKED") {
  const maps: SyncedRhythiaMap[] = [];
  let page = 1;
  let total = Infinity;
  while (maps.length < total && page <= 100) {
    const data = await rhythiaRequest<{ total?: number; beatmaps?: SyncedRhythiaMap[] }>("getBeatmaps", { status, page, session: "" });
    if (!data.beatmaps?.length) break;
    if (typeof data.total === "number") total = data.total;
    maps.push(...data.beatmaps);
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

  for (const { map, ranked: isRanked } of seen.values()) {
    if (!map.id || !map.beatmapFile) continue;
    const sourceUrl = `https://www.rhythia.com/maps/${map.id}`;
    const rating = ratingForMap(map);
    const existing = await prisma.challengeMap.findUnique({ where: { sourceBeatmapId: map.id }, select: { id: true, status: true, isAutoImported: true } });
    if (!existing) {
      await prisma.challengeMap.create({ data: { title: map.title || "Unknown map", artist: artistFromTitle(map.title || ""), description: null, mapFileUrl: map.beatmapFile, imageUrl: map.image, requestedRating: rating, rating: isRanked ? rating : null, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceBeatmapId: map.id, sourceUrl, isAutoImported: true, submittedById: importer.id, status: isRanked ? "approved" : "pending", reviewedById: isRanked ? importer.id : null, reviewedAt: isRanked ? new Date() : null } });
      created += 1;
      continue;
    }

    if (!existing.isAutoImported) continue;
    if (isRanked && existing.status === "pending") {
      await prisma.challengeMap.update({ where: { id: existing.id }, data: { title: map.title || "Unknown map", artist: artistFromTitle(map.title || ""), mapFileUrl: map.beatmapFile, imageUrl: map.image, requestedRating: rating, rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl, status: "approved", reviewedById: importer.id, reviewedAt: new Date() } });
      promoted += 1;
    } else {
      await prisma.challengeMap.update({ where: { id: existing.id }, data: { title: map.title || "Unknown map", artist: artistFromTitle(map.title || ""), mapFileUrl: map.beatmapFile, imageUrl: map.image, requestedRating: rating, mapperName: map.ownerUsername, noteCount: map.noteCount, length: map.length, sourceUrl } });
      updated += 1;
    }
  }

  await prisma.siteSetting.upsert({ where: { key: "rhythia_map_sync_last_run" }, update: { value: new Date().toISOString() }, create: { key: "rhythia_map_sync_last_run", value: new Date().toISOString(), description: "Last successful Rhythia ranked and unranked map synchronization." } });
  return { ranked: ranked.length, unranked: unranked.length, created, updated, promoted };
}
