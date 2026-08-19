import { prisma } from "@/lib/db";

export type MapSubmissionType = "ranked" | "challenge";
export type ChallengePlacement = "main" | "jumps" | "stream" | "tech" | "off_grid";

type MetadataRow = {
  mapId: string;
  submissionType: MapSubmissionType;
  challengePlacement: ChallengePlacement | null;
  challengeLevel: number | null;
};

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
  return rows[0] ?? null;
}

export async function getMapSubmissionMetadataMap(mapIds: string[]) {
  if (mapIds.length === 0) return new Map<string, MetadataRow>();
  const rows = await prisma.$queryRawUnsafe<MetadataRow[]>(
    `SELECT "mapId","submissionType","challengePlacement","challengeLevel" FROM "MapSubmissionMetadata" WHERE "mapId" = ANY($1::text[])`,
    mapIds,
  );
  return new Map(rows.map((row) => [row.mapId, row]));
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
