import { TournamentAdmin } from "@/components/admin/tournament-admin";
import { TournamentSelfTest } from "@/components/admin/tournament-self-test";

export const dynamic = "force-dynamic";

export default function TournamentLiveOperationsPage() {
  return <div className="space-y-7"><TournamentAdmin /><TournamentSelfTest /></div>;
}
