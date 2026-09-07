import { prisma } from "@/lib/db";
import { TOURNAMENT_MODES, tournamentCapState, type TournamentMode, type TournamentSplit } from "@/lib/tournaments";

type DueTournament = {
  id: string;
  mode: string;
  scheduledAt: Date;
};

type SplitCount = {
  split: TournamentSplit;
  count: number;
};

function asMode(value: string): TournamentMode | null {
  return TOURNAMENT_MODES.includes(value as TournamentMode) ? value as TournamentMode : null;
}

function missingPlayersText(split: TournamentSplit, count: number, minimum: number) {
  const remaining = Math.max(0, minimum - count);
  return `${split === "lower" ? "Lower" : "Higher"} split needs ${remaining} more player${remaining === 1 ? "" : "s"} to reach its ${minimum}-player minimum`;
}

export async function postponeDueTournaments(tournamentId?: string) {
  const due = tournamentId
    ? await prisma.$queryRawUnsafe<DueTournament[]>(
        `SELECT id,mode,"scheduledAt" FROM "Tournament" WHERE id=$1 AND status='scheduled' AND "publishedAt" IS NOT NULL AND "scheduledAt"<=CURRENT_TIMESTAMP`,
        tournamentId,
      )
    : await prisma.$queryRawUnsafe<DueTournament[]>(
        `SELECT id,mode,"scheduledAt" FROM "Tournament" WHERE status='scheduled' AND "publishedAt" IS NOT NULL AND "scheduledAt"<=CURRENT_TIMESTAMP ORDER BY "scheduledAt" ASC`,
      );

  const postponed: Array<{ id: string; scheduledAt: Date; reason: string }> = [];

  for (const tournament of due) {
    const mode = asMode(tournament.mode);
    if (!mode) continue;

    const counts = await prisma.$queryRawUnsafe<SplitCount[]>(
      `SELECT split,COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status<>'withdrawn' GROUP BY split`,
      tournament.id,
    );
    const lowerCount = Number(counts.find((row) => row.split === "lower")?.count ?? 0);
    const higherCount = Number(counts.find((row) => row.split === "higher")?.count ?? 0);
    const lower = tournamentCapState(mode, lowerCount);
    const higher = tournamentCapState(mode, higherCount);

    if (lower.canStart && higher.canStart) continue;

    const missing: string[] = [];
    if (!lower.canStart) missing.push(missingPlayersText("lower", lower.count, lower.minimum));
    if (!higher.canStart) missing.push(missingPlayersText("higher", higher.count, higher.minimum));
    const reason = `The tournament was automatically postponed by 5 days because ${missing.join(" and ")}.`;

    const updated = await prisma.$queryRawUnsafe<Array<{ id: string; scheduledAt: Date }>>(
      `UPDATE "Tournament"
       SET "postponedFrom"="scheduledAt",
           "scheduledAt"="scheduledAt" + INTERVAL '5 days',
           "postponedAt"=CURRENT_TIMESTAMP,
           "postponeReason"=$2,
           "postponementCount"="postponementCount" + 1,
           "updatedAt"=CURRENT_TIMESTAMP
       WHERE id=$1
         AND status='scheduled'
         AND "scheduledAt"<=CURRENT_TIMESTAMP
       RETURNING id,"scheduledAt"`,
      tournament.id,
      reason,
    );

    if (updated[0]) postponed.push({ id: tournament.id, scheduledAt: updated[0].scheduledAt, reason });
  }

  return postponed;
}
