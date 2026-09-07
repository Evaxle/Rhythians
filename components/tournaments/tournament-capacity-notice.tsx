"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Share2, Users } from "lucide-react";

type Split = "lower" | "higher";

type CapState = {
  count: number;
  minimum: number;
  secured: number;
  next: number | null;
  maximum: number;
  canStart: boolean;
  full: boolean;
};

export function TournamentCapacityNotice() {
  const [data, setData] = useState<any>(null);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/tournaments", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        if (active) setData(result);
      } catch {
        // The main tournament view already handles its own load errors.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const scheduled = data?.scheduled;
  const signup = scheduled?.viewerSignup;
  const playerSplit = signup?.status !== "withdrawn" && (signup?.split === "lower" || signup?.split === "higher") ? signup.split as Split : null;
  const playerCap = useMemo<CapState | null>(() => playerSplit ? scheduled?.caps?.[playerSplit] ?? null : null, [playerSplit, scheduled]);
  const playersNeeded = playerCap ? Math.max(0, Number(playerCap.minimum) - Number(playerCap.count)) : 0;
  const needsPlayers = Boolean(playerSplit && playerCap && !playerCap.canStart && playersNeeded > 0);
  const tournament = scheduled?.tournament;
  const wasPostponed = Boolean(tournament?.postponedAt && tournament?.postponedFrom && tournament?.postponeReason);

  if (!scheduled || (!needsPlayers && !wasPostponed)) return null;

  async function shareTournament() {
    if (!tournament || !playerSplit || !playerCap) return;
    const splitLabel = playerSplit === "lower" ? "Lower" : "Higher";
    const text = `Join me in ${tournament.name} on Rhythians. The ${splitLabel} split needs ${playersNeeded} more player${playersNeeded === 1 ? "" : "s"} to reach its ${playerCap.minimum}-player tournament cap.`;
    const url = `${window.location.origin}/tournaments`;

    try {
      if (navigator.share) {
        await navigator.share({ title: tournament.name, text, url });
        setShareStatus("Shared");
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareStatus("Invite copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Could not share");
    }
  }

  return (
    <div className="ui-page mb-6 space-y-3">
      {wasPostponed && (
        <section className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.12] via-orange-300/[0.055] to-transparent p-5 shadow-glow sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-200"><CalendarClock size={15} /> Tournament date moved</p>
              <h2 className="mt-2 text-xl font-bold text-white">{tournament.name} has been moved forward 5 days.</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{tournament.postponeReason}</p>
              <p className="mt-2 text-xs text-amber-100/80">Previous date: {new Date(tournament.postponedFrom).toLocaleString()} · New date: {new Date(tournament.scheduledAt).toLocaleString()}</p>
            </div>
            {Number(tournament.postponementCount ?? 0) > 0 && <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100">Delay #{tournament.postponementCount}</span>}
          </div>
        </section>
      )}

      {needsPlayers && playerCap && playerSplit && (
        <section className="rounded-[2rem] border border-sky-300/20 bg-gradient-to-br from-sky-400/[0.11] via-indigo-400/[0.055] to-transparent p-5 shadow-glow sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-200"><Users size={15} /> Help fill your bracket</p>
              <h2 className="mt-2 text-xl font-bold text-white">Your {playerSplit === "lower" ? "Lower" : "Higher"} split still needs {playersNeeded} more player{playersNeeded === 1 ? "" : "s"}.</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Your split currently has <span className="font-semibold text-white">{playerCap.count} / {playerCap.minimum}</span> players needed for the tournament to start. Share the tournament and invite friends who belong in your split so the bracket can be filled before the scheduled date.</p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={() => void shareTournament()} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(124,143,240,0.2)] transition hover:bg-accent2"><Share2 size={16} /> Share tournament</button>
              {shareStatus && <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-muted">{shareStatus !== "Could not share" && <Check size={13} className="text-emerald-300" />}{shareStatus}</span>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
