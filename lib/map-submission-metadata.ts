import { prisma } from "@/lib/db";

export type MapSubmissionType = "ranked" | "challenge";
export type ChallengePlacement = "main" | "jumps" | "stream" | "tech" | "off_grid";

type MetadataRow = {
  mapId: string;
  submissionType: MapSubmissionType;
  challengePlacement: ChallengePlacement | null;
  challengeLevel: number | null;
};

const categoryPlacements = new Set<ChallengePlacement>(["jumps", "stream", "tech", "off_grid"]);

export async function setMapSubmissionMetadata(
  mapId: string,
  submissionType: MapSubmissionType,
  challengePlacement: ChallengePlacement | null = null,
  challengeLevel: number | null = null,
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MapSubmissionMetadata" ("mapId","submissionType","challengePlacement","challengeLevel") VALUES ($1,$2,$3,$4) ON CONFLICT ("mapId") DO UPDATE SET "submissionType"=EXCLUDED."submissionType","challengePlacement"=EXCLUDED."challengePlacement","challengeLevel"=EXCLUDED."challengeLevel","updatedAt"=NOW()`,
    mapId,
    submissionType,
    challengePlacement,
    challengeLevel,
  );
}

export async function getMapSubmissionMetadata(mapId: string) {
  const rows = await prisma.$queryRawUnsafe<MetadataRow[]>(
    `SELECT "mapId","submissionType","challengePlacement","challengeLevel" FROM "MapSubmissionMetadata" WHERE "mapId" = $1 LIMIT 1`,
    mapId,
  );
  if (rows[0]) return rows[0];

  const challengeMap = await prisma.challengeMap.findUnique({
    where: { id: mapId },
    select: { id: true, isAutoImported: true },
  });
  if (challengeMap) {
    const metadata: MetadataRow = {
      mapId,
      submissionType: challengeMap.isAutoImported ? "ranked" : "challenge",
      challengePlacement: challengeMap.isAutoImported ? null : "main",
      challengeLevel: null,
    };
    await setMapSubmissionMetadata(mapId, metadata.submissionType, metadata.challengePlacement, metadata.challengeLevel);
    return metadata;
  }

  const categoryMap = await prisma.categoryMap.findUnique({
    where: { id: mapId },
    select: { id: true, category: true, level: true },
  });
  if (categoryMap && categoryPlacements.has(categoryMap.category as ChallengePlacement)) {
    const metadata: MetadataRow = {
      mapId,
      submissionType: "challenge",
      challengePlacement: categoryMap.category as ChallengePlacement,
      challengeLevel: categoryMap.level,
    };
    await setMapSubmissionMetadata(mapId, metadata.submissionType, metadata.challengePlacement, metadata.challengeLevel);
    return metadata;
  }

  return null;
}

export async function getMapSubmissionMetadataMap(mapIds: string[]) {
  if (mapIds.length === 0) return new Map<string, MetadataRow>();
  const rows = await prisma.$queryRawUnsafe<MetadataRow[]>(
    `SELECT "mapId","submissionType","challengePlacement","challengeLevel" FROM "MapSubmissionMetadata" WHERE "mapId" = ANY($1::text[])`,
    mapIds,
  );
  const result = new Map(rows.map((row) => [row.mapId, row]));
  const missing = mapIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    const repaired = await Promise.all(missing.map((id) => getMapSubmissionMetadata(id)));
    for (const row of repaired) if (row) result.set(row.mapId, row);
  }
  return result;
}

export async function getChallengeMapMetadata(mapId: string) {
  const metadata = await getMapSubmissionMetadata(mapId);
  if (!metadata || metadata.submissionType !== "challenge") return null;
  return metadata;
}

export async function getChallengeMapIds(mapIds: string[]) {
  const metadata = await getMapSubmissionMetadataMap(mapIds);
  return mapIds.filter((id) => metadata.get(id)?.submissionType === "challenge");
}

export async function getRankedMapIds(mapIds: string[]) {
  const metadata = await getMapSubmissionMetadataMap(mapIds);
  return mapIds.filter((id) => metadata.get(id)?.submissionType === "ranked");
}
