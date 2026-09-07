import { prisma } from "@/lib/db";
import { TOURNAMENT_CAPS, TOURNAMENT_MODES, type TournamentMode, type TournamentSplit } from "@/lib/tournaments";

type DueTournament = { id: string; mode: string; scheduledAt: Date; targetPlayersPerSplit: number | null };
type SplitCount = { split: TournamentSplit; count: number };

function asMode(value: string): TournamentMode | null {
  return TOURNAMENT_MODES.includes(value as TournamentMode) ? value as TournamentMode : null;
}

function targetFor(mode: TournamentMode, configured: number | null) {
  return configured && TOURNAMENT_CAPS[mode].includes(configured as never) ? configured : TOURNAMENT_CAPS[mode][2];
}

function missingPlayersText(split: TournamentSplit, count: number, target: number) {
  const remaining = Math.max(0, target - count);
  return `${split === "lower" ? "Lower" : "Higher"} split needs ${remaining} more player${remaining === 1 ? "" : "s"} to fill its ${target}-player bracket`;
}

export async function postponeDueTournaments(tournamentId?: string) {
  const due = tournamentId
    ? await prisma.$queryRawUnsafe<DueTournament[]>(`SELECT id,mode,"scheduledAt","targetPlayersPerSplit" FROM "Tournament" WHERE id=$1 AND status='scheduled' AND "publishedAt" IS NOT NULL AND "scheduledAt"<=CURRENT_TIMESTAMP`, tournamentId)
    : await prisma.$queryRawUnsafe<DueTournament[]>(`SELECT id,mode,"scheduledAt","targetPlayersPerSplit" FROM "Tournament" WHERE status='scheduled' AND "publishedAt" IS NOT NULL AND "scheduledAt"<=CURRENT_TIMESTAMP ORDER BY "scheduledAt" ASC`);

  const postponed: Array<{ id: string; scheduledAt: Date; reason: string }> = [];
  for (const tournament of due) {
    const mode = asMode(tournament.mode);
    if (!mode) continue;
    const target = targetFor(mode, tournament.targetPlayersPerSplit);
    const counts = await prisma.$queryRawUnsafe<SplitCount[]>(`SELECT split,COUNT(*)::int AS count FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status NOT IN ('withdrawn','kicked') GROUP BY split`, tournament.id);
    const lowerCount = Number(counts.find((row) => row.split === "lower")?.count ?? 0);
    const higherCount = Number(counts.find((row) => row.split === "higher")?.count ?? 0);
    if (lowerCount === target && higherCount === target) continue;

    const missing: string[] = [];
    if (lowerCount < target) missing.push(missingPlayersText("lower", lowerCount, target));
    if (higherCount < target) missing.push(missingPlayersText("higher", higherCount, target));
    if (lowerCount > target || higherCount > target) missing.push("an administrator must resolve extra signups above the configured bracket target");
    const reason = `The tournament was automatically postponed by 5 days because ${missing.join(" and ")}.`;

    const updated = await prisma.$queryRawUnsafe<Array<{ id: string; scheduledAt: Date }>>(
      `UPDATE "Tournament" SET "postponedFrom"="scheduledAt","scheduledAt"="scheduledAt" + INTERVAL '5 days',"postponedAt"=CURRENT_TIMESTAMP,"postponeReason"=$2,"postponementCount"="postponementCount" + 1,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status='scheduled' AND "scheduledAt"<=CURRENT_TIMESTAMP RETURNING id,"scheduledAt"`,
      tournament.id,
      reason,
    );
    if (updated[0]) postponed.push({ id: tournament.id, scheduledAt: updated[0].scheduledAt, reason });
  }
  return postponed;
}
