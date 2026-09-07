"use client";

import { useCallback, useEffect, useState } from "react";
import { ScheduledMapPool } from "@/components/tournaments/scheduled-map-pool";
import { SignedUpRoster } from "@/components/tournaments/signed-up-roster";

export function ScheduledTournamentCommunity({ tournamentId }: { tournamentId: string }) {
  const [signups, setSignups] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/roster?ts=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setAuthorized(false);
          setSignups([]);
        }
        return;
      }
      const data = await response.json();
      setAuthorized(true);
      setSignups(data?.signups ?? []);
    } catch {
      // Preserve the last successful state through temporary network failures.
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  if (!authorized) return null;
  return <div className="min-w-0 space-y-6"><SignedUpRoster signups={signups} /><ScheduledMapPool tournamentId={tournamentId} /></div>;
}
