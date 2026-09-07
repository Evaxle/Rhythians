"use client";

import { useEffect, useState } from "react";
import { ScheduledMapPool } from "@/components/tournaments/scheduled-map-pool";
import { SignedUpRoster } from "@/components/tournaments/signed-up-roster";

export function ScheduledTournamentCommunity({ tournamentId }: { tournamentId: string }) {
  const [signups, setSignups] = useState<any[]>([]);
  useEffect(() => { void fetch(`/api/tournaments/${tournamentId}/roster`, { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((data) => setSignups(data?.signups ?? [])).catch(() => null); }, [tournamentId]);
  return <div className="space-y-6"><SignedUpRoster signups={signups} /><ScheduledMapPool tournamentId={tournamentId} /></div>;
}