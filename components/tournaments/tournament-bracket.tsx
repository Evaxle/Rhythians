"use client";

import { Crown, Swords } from "lucide-react";

function TeamName({ team, winner }: { team: any; winner?: boolean }) {
  if (!team) return <span className="text-muted">TBD</span>;
  const names = (team.members ?? []).map((member: any) => member.displayName ?? member.username).join(" + ");
  return <span className={winner ? "font-bold text-emerald-200" : "font-semibold text-white"}>{names || `Team ${team.seed}`}</span>;
}

function MatchCard({ match }: { match: any }) {
  return (
    <div className="min-w-[220px] rounded-2xl border border-white/10 bg-black/15 p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        <span>Round {match.round}</span>
        <span>{String(match.status).replace("_", " ")}</span>
      </div>
      <div className={`rounded-xl border px-3 py-2 ${match.winnerTeamId === match.team1Id ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"}`}><TeamName team={match.team1} winner={match.winnerTeamId === match.team1Id} /></div>
      <div className="py-1 text-center text-[10px] font-black text-muted">VS</div>
      <div className={`rounded-xl border px-3 py-2 ${match.winnerTeamId === match.team2Id ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"}`}><TeamName team={match.team2} winner={match.winnerTeamId === match.team2Id} /></div>
      {match.map?.title && <p className="mt-2 truncate text-[11px] text-muted">{match.map.title}</p>}
    </div>
  );
}

function Side({ matches, align }: { matches: any[]; align: "left" | "right" }) {
  const rounds = [...new Set(matches.map((match) => Number(match.round)))].sort((a, b) => align === "left" ? a - b : b - a);
  if (!rounds.length) return <div className="min-w-[220px] rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">Bracket pending</div>;
  return (
    <div className="flex min-w-max gap-4">
      {rounds.map((round) => (
        <div key={round} className="flex w-[220px] flex-col justify-around gap-4">
          {matches.filter((match) => Number(match.round) === round).map((match) => <MatchCard key={match.id} match={match} />)}
        </div>
      ))}
    </div>
  );
}

export function TournamentBracket({ matches, split }: { matches: any[]; split: "lower" | "higher" }) {
  const splitMatches = matches.filter((match) => match.split === split);
  const left = splitMatches.filter((match) => match.side === "left");
  const right = splitMatches.filter((match) => match.side === "right");
  const final = splitMatches.find((match) => match.side === "final");
  return (
    <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-5 shadow-glow sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">{split === "lower" ? "Lower" : "Higher"} split</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Tournament bracket</h2>
        </div>
        {final?.winner && <div className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-100"><Crown size={16} /><TeamName team={final.winner} winner /></div>}
      </div>
      {!splitMatches.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">The bracket has not been generated yet.</div> : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-stretch gap-5">
            <Side matches={left} align="left" />
            <div className="flex w-[240px] shrink-0 items-center justify-center">
              {final ? <div className="w-full"><div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><Swords size={14} /> Final</div><MatchCard match={final} /></div> : <div className="text-sm text-muted">Final pending</div>}
            </div>
            <Side matches={right} align="right" />
          </div>
        </div>
      )}
    </section>
  );
}
