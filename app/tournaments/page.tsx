import { TournamentsApp } from "@/components/tournaments/tournaments-app";
import { TournamentCapacityNotice } from "@/components/tournaments/tournament-capacity-notice";
import { ScheduledTournamentCommunity } from "@/components/tournaments/scheduled-tournament-community";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const user = await getSessionUser();
  let signedUpTournamentId: string | null = null;
  if (user) {
    const row = (await prisma.$queryRawUnsafe<Array<{ tournamentId: string }>>(
      `SELECT s."tournamentId" FROM "TournamentSignup" s JOIN "Tournament" t ON t.id=s."tournamentId" WHERE s."userId"=$1 AND s.status NOT IN ('withdrawn','kicked') AND t.status='scheduled' AND t."publishedAt" IS NOT NULL ORDER BY t."scheduledAt" ASC LIMIT 1`,
      user.id,
    ))[0];
    signedUpTournamentId = row?.tournamentId ?? null;
  }
  return <><TournamentCapacityNotice /><TournamentsApp />{signedUpTournamentId && <div className="ui-page mt-6"><ScheduledTournamentCommunity tournamentId={signedUpTournamentId} /></div>}</>;
}