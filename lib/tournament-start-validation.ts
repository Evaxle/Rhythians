import "@/lib/tournament-cap-overrides";
import { prisma } from "@/lib/db";
import { TOURNAMENT_CAPS, tournamentTeamSize, type TournamentMode, type TournamentSplit } from "@/lib/tournaments";

function requiredStageMaps(mode: TournamentMode, targetPlayersPerSplit: number) {
  if (!TOURNAMENT_CAPS[mode].includes(targetPlayersPerSplit as never)) throw new Error("Tournament player target is invalid.");
  const teams = targetPlayersPerSplit / tournamentTeamSize(mode);
  const rounds = Math.log2(teams);
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error("Tournament target does not create a valid bracket.");
  const totalMatches = teams - 1;
  const finals = rounds <= 2 ? totalMatches : 3;
  return { regular: totalMatches - finals, finals };
}

export async function validateTournamentStageMapPool(tournamentId: string) {
  const tournament = (await prisma.$queryRawUnsafe<Array<{ mode: TournamentMode; targetPlayersPerSplit: number }>>(
    `SELECT mode,"targetPlayersPerSplit" FROM "Tournament" WHERE id=$1 AND status='scheduled'`,
    tournamentId,
  ))[0];
  if (!tournament) throw new Error("Only a scheduled tournament can be started.");
  const required = requiredStageMaps(tournament.mode, Number(tournament.targetPlayersPerSplit));

  for (const split of ["lower", "higher"] as TournamentSplit[]) {
    const rows = await prisma.$queryRawUnsafe<Array<{ stage: string; count: number }>>(
      `SELECT p.stage,COUNT(DISTINCT p."mapId")::int AS count
       FROM "TournamentMapPool" p
       JOIN "ChallengeMap" m ON m.id=p."mapId"
       WHERE p."tournamentId"=$1 AND p.split=$2
         AND m.status::text='approved' AND m.rating IS NOT NULL
         AND m."reviewerNote" IS DISTINCT FROM 'rhythia-unranked'
         AND p.stage IN ('regular','finals')
       GROUP BY p.stage`,
      tournamentId,
      split,
    );
    const regular = Number(rows.find((row) => row.stage === "regular")?.count ?? 0);
    const finals = Number(rows.find((row) => row.stage === "finals")?.count ?? 0);
    const label = split === "lower" ? "Lower" : "Higher";
    if (regular < required.regular) throw new Error(`${label} regular map pool needs ${required.regular} unique ranked maps; it currently has ${regular}.`);
    if (finals < required.finals) throw new Error(`${label} finals map pool needs ${required.finals} unique ranked maps; it currently has ${finals}.`);
  }

  return required;
}
