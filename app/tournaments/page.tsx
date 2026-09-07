import { TournamentsApp } from "@/components/tournaments/tournaments-app";
import { TournamentCapacityNotice } from "@/components/tournaments/tournament-capacity-notice";
import { ScheduledTournamentCommunity } from "@/components/tournaments/scheduled-tournament-community";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const user = await getSessionUser();
  let scheduledTournamentId: string | null = null;

  if (user) {
    const signup = (await prisma.$queryRawUnsafe<Array<{ tournamentId: string }>>(
      `SELECT s."tournamentId" FROM "TournamentSignup" s JOIN "Tournament" t ON t.id=s."tournamentId" WHERE s."userId"=$1 AND s.status NOT IN ('withdrawn','kicked') AND t.status='scheduled' AND t."publishedAt" IS NOT NULL ORDER BY t."scheduledAt" ASC LIMIT 1`,
      user.id,
    ))[0];
    scheduledTournamentId = signup?.tournamentId ?? null;

    if (!scheduledTournamentId) {
      const scheduled = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Tournament" WHERE status='scheduled' AND "publishedAt" IS NOT NULL ORDER BY "scheduledAt" ASC LIMIT 1`,
      ))[0];
      scheduledTournamentId = scheduled?.id ?? null;
    }
  }

  return <><TournamentCapacityNotice /><TournamentsApp />{scheduledTournamentId && <div className="ui-page mt-6 min-w-0"><ScheduledTournamentCommunity tournamentId={scheduledTournamentId} /></div>}</>;
}
