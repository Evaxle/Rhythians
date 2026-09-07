"use client";

import Link from "next/link";
import { Crown, Swords } from "lucide-react";

function Member({ member }: { member: any }) {
  const name = member?.displayName ?? member?.username ?? "Unknown";
  const content = <><span className="min-w-0 truncate font-semibold text-white">{name}</span><span className={`shrink-0 font-mono text-[11px] ${member?.accuracy == null ? "text-muted" : "text-accent"}`}>{member?.accuracy == null ? "—" : `${Number(member.accuracy).toFixed(2)}%`}</span></>;
  return member?.profileHandle ? <Link href={`/profile/${encodeURIComponent(member.profileHandle)}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.06]">{content}</Link> : <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">{content}</div>;
}

function TeamPanel({ team, winner, score, showCaptainScore }: { team: any; winner?: boolean; score?: number | null; showCaptainScore: boolean }) {
  if (!team) return <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-muted">TBD</div>;
  return (
    <div className={`rounded-xl border px-2 py-2 ${winner ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="space-y-0.5">{(team.members ?? []).map((member: any) => <Member key={member.userId ?? member.id} member={member} />)}</div>
      {showCaptainScore && score != null && <div className="mt-2 flex items-center justify-between border-t border-white/10 px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted"><span>Captains choice</span><span className={winner ? "text-emerald-200" : "text-white"}>{Number(score).toFixed(2)}%</span></div>}
    </div>
  );
}

function MatchCard({ match, mode }: { match: any; mode?: string }) {
  const teamMode = mode === "2v2" || mode === "3v3";
  return (
    <div className="min-w-[250px] rounded-2xl border border-white/10 bg-black/15 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"><span>Round {match.round}</span><span>{String(match.status).replace(/_/g, " ")}</span></div>
      <TeamPanel team={match.team1} winner={match.winnerTeamId === match.team1Id} score={match.team1Score} showCaptainScore={teamMode && match.status === "completed"} />
      <div className="py-1 text-center text-[10px] font-black text-muted">VS</div>
      <TeamPanel team={match.team2} winner={match.winnerTeamId === match.team2Id} score={match.team2Score} showCaptainScore={teamMode && match.status === "completed"} />
      {match.map?.title && <div className="mt-2 rounded-xl border border-white/5 bg-black/10 px-3 py-2"><p className="truncate text-[11px] font-semibold text-white">{match.map.title}</p><p className="mt-0.5 text-[10px] text-muted">{match.map.rating != null ? `${Number(match.map.rating).toFixed(2)}★` : ""}{match.map.length != null ? `${match.map.rating != null ? " · " : ""}${Math.floor(Number(match.map.length) / 60)}:${String(Number(match.map.length) % 60).padStart(2, "0")}` : ""}</p></div>}
    </div>
  );
}

function Side({ matches, align, mode }: { matches: any[]; align: "left" | "right"; mode?: string }) {
  const rounds = [...new Set(matches.map((match) => Number(match.round)))].sort((a, b) => align === "left" ? a - b : b - a);
  if (!rounds.length) return <div className="min-w-[250px] rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">Bracket pending</div>;
  return <div className="flex min-w-max gap-4">{rounds.map((round) => <div key={round} className="flex w-[250px] flex-col justify-around gap-4">{matches.filter((match) => Number(match.round) === round).map((match) => <MatchCard key={match.id} match={match} mode={mode} />)}</div>)}</div>;
}

function WinnerNames({ team }: { team: any }) {
  return <>{team?.members?.map((member: any) => member.displayName ?? member.username).join(" + ") || "Winner"}</>;
}

export function TournamentBracket({ matches, split, mode }: { matches: any[]; split: "lower" | "higher"; mode?: string }) {
  const splitMatches = matches.filter((match) => match.split === split);
  const left = splitMatches.filter((match) => match.side === "left");
  const right = splitMatches.filter((match) => match.side === "right");
  const final = splitMatches.find((match) => match.side === "final");
  return (
    <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-5 shadow-glow sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">{split === "lower" ? "Lower" : "Higher"} split</p><h2 className="mt-1 text-2xl font-semibold text-white">Tournament bracket</h2><p className="mt-1 text-xs text-muted">Player accuracies update with submitted tournament scores.</p></div>{final?.winner && <div className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-100"><Crown size={16} /><WinnerNames team={final.winner} /></div>}</div>
      {!splitMatches.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">The bracket has not been generated yet.</div> : <div className="overflow-x-auto pb-2"><div className="flex min-w-max items-stretch gap-5"><Side matches={left} align="left" mode={mode} /><div className="flex w-[270px] shrink-0 items-center justify-center">{final ? <div className="w-full"><div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><Swords size={14} /> Final</div><MatchCard match={final} mode={mode} /></div> : <div className="text-sm text-muted">Final pending</div>}</div><Side matches={right} align="right" mode={mode} /></div></div>}
    </section>
  );
}
