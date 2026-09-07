import { TournamentMapPoolAdmin } from "@/components/admin/tournament-map-pool-admin";
import { TournamentRuntimeSettings } from "@/components/admin/tournament-runtime-settings";

export const dynamic = "force-dynamic";

export default function TournamentMapPoolsPage() {
  return <div className="space-y-6"><TournamentRuntimeSettings /><TournamentMapPoolAdmin /></div>;
}
