import { hashToken } from "@/lib/rhythkit";
import { RANKS, isMapInRankRange } from "@/lib/ranks";
import { prisma } from "@/lib/db";

export type RhythKitInstallation = {
  userId: string;
  installationId: string;
  revokedAt: Date | null;
};

export async function getRhythKitInstallation(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  const rows = await prisma.$queryRawUnsafe<RhythKitInstallation[]>(
    `SELECT "userId", "installationId", "revokedAt" FROM "RhythKitInstallation" WHERE "tokenHash" = $1 LIMIT 1`,
    hashToken(token)
  );
  const installation = rows[0];
  if (!installation || installation.revokedAt) return null;
  await prisma.$executeRawUnsafe(
    `UPDATE "RhythKitInstallation" SET "lastSeenAt" = NOW() WHERE "installationId" = $1`,
    installation.installationId
  );
  return installation;
}

export function getMapRankMeta(rating: number) {
  const safeRating = Math.max(0, Math.min(9.99, rating));
  const index = RANKS.findIndex((rank) => safeRating >= rank.rangeMin && safeRating <= rank.rangeMax);
  const rank = RANKS[index === -1 ? RANKS.length - 1 : index];
  if (rank.index === RANKS.length - 1) return { name: rank.name, color: rank.color };
  const span = Math.max(0.01, rank.rangeMax - rank.rangeMin);
  const progress = Math.min(0.999999, Math.max(0, (safeRating - rank.rangeMin) / span));
  const tier = Math.min(5, Math.floor(progress * 5) + 1);
  return { name: `${rank.name} ${tier}`, color: rank.color };
}

export function isRankedMap(rating: number | null, reviewerNote: string | null, status: string) {
  return status === "approved" && rating != null && reviewerNote !== "rhythia-unranked";
}

export function isMapAllowed(rating: number | null, reviewerNote: string | null, status: string, rankIndex: number) {
  if (status === "legacy") return true;
  if (!isRankedMap(rating, reviewerNote, status)) return true;
  return rating != null && isMapInRankRange(rating, rankIndex);
}

export function mapLengthSeconds(length: number | null) {
  if (length == null || !Number.isFinite(length) || length <= 0) return 0;
  return Math.max(0, Math.round(length / 1000));
}

export function safeMapRating(rating: number | null) {
  return Math.max(0, Math.min(9.99, Number.isFinite(rating ?? NaN) ? rating ?? 0 : 0));
}

export function safeLimit(value: string | null, fallback = 25, maximum = 100) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, parsed));
}
