import { prisma } from "@/lib/db";
import { TOURNAMENT_CAPS, type TournamentMode, type TournamentSplit } from "@/lib/tournaments";

const CAPACITY_BY_MODE: Record<TournamentMode, [number, number, number]> = {
  "1v1": [16, 32, 64],
  "2v2": [32, 64, 128],
  "3v3": [48, 96, 192],
};

for (const mode of Object.keys(CAPACITY_BY_MODE) as TournamentMode[]) {
  TOURNAMENT_CAPS[mode] = CAPACITY_BY_MODE[mode];
}

export function tournamentCapacityForMode(mode: TournamentMode) {
  return CAPACITY_BY_MODE[mode];
}

export function tournamentCapacityTarget(mode: TournamentMode, count: number) {
  const caps = CAPACITY_BY_MODE[mode];
  if (count <= caps[0]) return caps[0];
  if (count <= caps[1]) return caps[1];
  return caps[2];
}

export async function prepareTournamentCapacityForSignup(tournamentId: string, split: TournamentSplit) {
  const tournament = (await prisma.$queryRawUnsafe<Array<{ mode: TournamentMode; targetPlayersPerSplit: number | null }>>(
    `SELECT mode,"targetPlayersPerSplit" FROM "Tournament" WHERE id=$1 AND status='scheduled'`,
    tournamentId,
  ))[0];
  if (!tournament || !CAPACITY_BY_MODE[tournament.mode]) return;

  const rows = await prisma.$queryRawUnsafe<Array<{ split: TournamentSplit; count: number }>>(
    `SELECT split,COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status NOT IN ('withdrawn','kicked') GROUP BY split`,
    tournamentId,
  );
  const splitCount = Number(rows.find((row) => row.split === split)?.count ?? 0);
  const currentTarget = Number(tournament.targetPlayersPerSplit ?? 0);
  const caps = CAPACITY_BY_MODE[tournament.mode];
  const currentIndex = caps.indexOf(currentTarget);
  const desired = tournamentCapacityTarget(tournament.mode, splitCount + 1);
  const desiredIndex = caps.indexOf(desired);

  if (currentIndex < desiredIndex || currentIndex === -1) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Tournament" SET "targetPlayersPerSplit"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='scheduled'`,
      tournamentId,
      desired,
    );
  }
}
