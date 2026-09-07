import { TournamentsApp } from "@/components/tournaments/tournaments-app";
import { TournamentCapacityNotice } from "@/components/tournaments/tournament-capacity-notice";

export const dynamic = "force-dynamic";

export default function TournamentsPage() {
  return <><TournamentCapacityNotice /><TournamentsApp /></>;
}
