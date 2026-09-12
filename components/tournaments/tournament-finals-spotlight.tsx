"use client";

import { useEffect, useState } from "react";
import { Clock3, Crown, Swords } from "lucide-react";

function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  return <span className="tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>;
}

function names(team: any) {
  return team?.members?.map((member: any) => member.displayName ?? member.username).join(" + ") || "TBD";
}

function FinalCard({ match, label }: { match: any; label: string }) {
  if (!match) return null;
  const live = match.status === "active";
  const complete = match.status === "completed";
  const deadline = live ? match.matchDeadlineAt : match.status === "map_ready" ? match.playStartsAt : match.countdownEndsAt;
  return <div className={`relative overflow-hidden rounded-[1.75rem] border p-5 ${live ? "border-fuchsia-400/35 bg-fuchsia-400/[0.07]" : complete ? "border-amber-300/30 bg-amber-300/[0.06]" : "border-white/10 bg-black/15"}`}>
    {live && <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-100"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300" />Live</span>}
    <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">{label} final</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center"><div className={`rounded-2xl border p-4 ${match.winnerTeamId === match.team1Id ? "border-amber-300/30 bg-amber-300/10" : "border-white/8 bg-black/10"}`}><p className="text-sm font-bold text-white">{names(match.team1)}</p><p className="mt-1 font-mono text-xl font-black text-accent">{match.team1Score == null ? "—" : `${Number(match.team1Score).toFixed(2)}%`}</p></div><Swords size={18} className="mx-auto text-muted" /><div className={`rounded-2xl border p-4 ${match.winnerTeamId === match.team2Id ? "border-amber-300/30 bg-amber-300/10" : "border-white/8 bg-black/10"}`}><p className="text-sm font-bold text-white">{names(match.team2)}</p><p className="mt-1 font-mono text-xl font-black text-accent">{match.team2Score == null ? "—" : `${Number(match.team2Score).toFixed(2)}%`}</p></div></div>
    {match.map?.title && <div className="mt-3 rounded-xl border border-white/8 bg-black/10 px-3 py-2"><p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Final map</p><p className="mt-1 truncate text-sm font-bold text-white">{match.map.title}</p></div>}
    {deadline && !complete && <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Clock3 size={13} /> {match.status === "intermission" ? "Preparation" : match.status === "map_countdown" ? "Map reveal" : match.status === "map_ready" ? "Play starts" : "Time left"}: <span className="font-bold text-white"><Countdown deadline={deadline} /></span></p>}
    {complete && match.winner && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-100"><Crown size={15} /> {names(match.winner)} won the {label} split.</p>}
  </div>;
}

export function TournamentFinalsSpotlight({ matches }: { matches: any[] }) {
  const lower = matches.find((match) => match.split === "lower" && match.side === "final");
  const higher = matches.find((match) => match.split === "higher" && match.side === "final");
  const visible = [lower, higher].some((match) => match?.team1Id || match?.team2Id || match?.status === "completed");
  if (!visible) return null;
  return <section className="overflow-hidden rounded-[2.2rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,.13),transparent_38%),linear-gradient(145deg,rgba(20,27,45,.97),rgba(8,12,22,.98))] p-6 shadow-glow sm:p-7"><div className="text-center"><p className="text-xs font-black uppercase tracking-[0.26em] text-fuchsia-200">Championship stage</p><h2 className="mt-2 text-3xl font-black text-white">Tournament finals</h2><p className="mt-2 text-sm text-muted">The last matchup from each split is featured here for every viewer.</p></div><div className="mt-6 grid gap-4 xl:grid-cols-2"><FinalCard match={lower} label="Lower" /><FinalCard match={higher} label="Higher" /></div></section>;
}
