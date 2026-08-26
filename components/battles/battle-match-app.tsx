"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Crown, Download, Loader2, Swords, Trophy, UserRound } from "lucide-react";
import { getRankInfo, rankLabel } from "@/lib/ranks";
import { CasualMapSelection } from "@/components/battles/casual-map-selection";

function Avatar({ player, large = false }: { player: any; large?: boolean }) {
  const size = large ? "h-20 w-20" : "h-12 w-12";
  if (player?.avatar) return <img src={player.avatar} alt={player.username} className={`${size} rounded-full border border-border object-cover`} />;
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-full border border-border bg-accent/10 text-accent`}><UserRound size={large ? 28 : 19} /></div>;
}

export function BattleMatchApp({ matchId }: { matchId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [revealTick, setRevealTick] = useState(Date.now());

  async function load() {
    try {
      const response = await fetch(`/api/battles/matches?id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const result = await response.json();
      if (response.ok) { setData(result); setError(""); } else setError(result.error ?? "Match not found.");
    } catch { setError("Could not update the battle."); } finally { setLoading(false); }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 1000);
    return () => clearInterval(timer);
  }, [matchId]);

  useEffect(() => {
    if (!data?.match?.startedAt || data.match.status !== "active") return;
    setCountdown(3);
    const timer = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [data?.match?.startedAt, data?.match?.status]);

  useEffect(() => {
    if (data?.match?.status !== "finished") return;
    const timer = setInterval(() => setRevealTick(Date.now()), 50);
    return () => clearInterval(timer);
  }, [data?.match?.status]);

  async function accept() {
    setAccepting(true); setError("");
    try {
      const response = await fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", matchId }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Could not accept battle."); return; }
      await load();
    } catch { setError("Could not accept battle."); } finally { setAccepting(false); }
  }

  async function checkScore() {
    setChecking(true); setError("");
    try {
      const response = await fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check-score", matchId }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Could not check your score."); return; }
      await load();
    } catch { setError("Could not check your score."); } finally { setChecking(false); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-muted"><Loader2 className="mr-2 animate-spin" />Loading battle...</div>;
  if (!data) return <div className="mx-auto max-w-2xl rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center text-red-300">{error || "Battle unavailable."}</div>;

  const players = data.players ?? [];
  const teamOne = players.filter((player: any) => player.team === 1);
  const teamTwo = players.filter((player: any) => player.team === 2);
  const mode = String(data.match.mode ?? "1v1").split(":")[0];
  const finished = data.match.status === "finished";
  const viewer = players.find((player: any) => player.userId === data.viewerId);
  const canAccept = data.match.status === "invite" && viewer?.team === 2;
  const waitingForOwnScore = data.match.status === "active" && viewer?.accuracy == null;
  const teamScores = data.teamScores ?? { one: null, two: null, winner: null };

  const Team = ({ team, label }: { team: any[]; label: string }) => <section className="flex-1 rounded-3xl border border-border bg-surface/95 p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-accent">{label}</p><p className="mt-1 text-sm text-muted">{team.length} players</p></div><Trophy className="text-accent" size={20} /></div><div className={mode === "15v15" ? "grid grid-cols-3 gap-2" : "space-y-3"}>{team.map((player: any) => { const rank = getRankInfo(player.rhp); return <Link href={`/profile/${encodeURIComponent(player.profileHandle)}`} key={player.userId} className="group flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3 transition hover:border-accent/30"><Avatar player={player} large={mode === "1v1"} /><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white group-hover:text-accent">{player.displayName ?? player.username}</p><span className="mt-1 inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold" style={{ color: rank.color }}>{rankLabel(rank)}</span></div></Link>; })}</div></section>;

  const MapPanel = () => data.map && <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-center gap-5">{data.map.imageUrl && <img src={data.map.imageUrl} alt="" className="h-24 w-24 rounded-2xl object-cover" />}<div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-[0.2em] text-accent">Battle map</p><h2 className="mt-1 text-xl font-semibold text-white">{data.map.title}</h2><p className="mt-1 text-sm text-muted">{data.map.artist ?? ""}{data.map.rating != null ? ` · ${Number(data.map.rating).toFixed(2)}★` : ""}</p></div>{data.map.mapFileUrl && <a href={data.map.mapFileUrl} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-white hover:border-accent/40"><Download size={16} /> Download map</a>}{!finished && data.match.status === "active" && <button disabled={checking || countdown > 0} onClick={checkScore} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{checking ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Check score</button>}</div>{error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}</section>;

  const Waiting = () => <section className="mx-auto w-full max-w-4xl rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]"><div className="flex flex-col items-center rounded-3xl border border-accent/20 bg-accent/5 p-7 text-center"><Avatar player={teamOne[0]} large /><p className="mt-4 font-semibold text-white">{teamOne[0]?.displayName ?? teamOne[0]?.username}</p><span className="mt-2 text-xs text-muted">{teamOne[0] ? rankLabel(getRankInfo(teamOne[0].rhp)) : ""}</span></div><div className="flex flex-col items-center gap-3"><div className="flex h-20 w-20 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-2xl font-black italic text-accent">VS</div><span className="text-xs uppercase tracking-[0.18em] text-muted">{canAccept ? "Challenge" : "Waiting"}</span></div><div className="flex flex-col items-center rounded-3xl border border-border bg-background/40 p-7 text-center"><Avatar player={teamTwo[0]} large /><p className="mt-4 font-semibold text-white">{teamTwo[0]?.displayName ?? teamTwo[0]?.username}</p>{canAccept ? <button disabled={accepting} onClick={accept} className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{accepting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Accept 1v1</button> : <p className="mt-2 text-xs text-muted">Waiting for the other player to accept.</p>}</div></div>{error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}</section>;

  const Result = () => { const finishedAt = data.match.finishedAt ? new Date(data.match.finishedAt).getTime() : 0; const elapsed = Math.max(0, revealTick - finishedAt); const winner = teamScores.winner; const winnerTeam = winner === 1 ? teamOne : winner === 2 ? teamTwo : []; const winnerScore = winner === 1 ? teamScores.one : winner === 2 ? teamScores.two : null; const winnerName = winnerTeam.length === 1 ? winnerTeam[0]?.displayName ?? winnerTeam[0]?.username : winner === 0 ? "Draw" : `Team ${winner}`; const revealAll = elapsed >= 3000; return <section className="overflow-hidden rounded-3xl border border-accent/30 bg-surface/95 p-8 shadow-glow"><div className="text-center"><p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.24em] text-accent">{winner === 0 ? <Trophy size={15} /> : <Crown size={15} />} {winner === 0 ? "Battle result" : "Winner"}</p><h2 className="mt-3 text-4xl font-black text-white">{winnerName}</h2>{!revealAll && winner !== 0 && winnerScore != null && <p className="mt-3 text-6xl font-black tabular-nums text-accent">{Number(winnerScore).toFixed(2)}%</p>}</div>{revealAll && <div className="mt-8 grid gap-4 md:grid-cols-2">{players.map((player: any) => <div key={player.userId} className={`flex items-center gap-4 rounded-2xl border p-4 ${player.team === winner ? "border-accent/40 bg-accent/10" : "border-border bg-background/40"}`}><Avatar player={player} /><div className="min-w-0 flex-1"><p className="font-semibold text-white">{player.displayName ?? player.username}</p><p className="text-xs text-muted">Team {player.team}</p></div><p className="text-xl font-black tabular-nums text-white">{player.accuracy != null ? `${Number(player.accuracy).toFixed(2)}%` : "—"}</p></div>)}</div>}<div className="mt-8 text-center"><p className="text-sm text-muted">{data.match.matchType === "ranked" ? "Ranked rewards have been processed." : "Casual battle complete."}</p><Link href="/battles/history" className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">Battle history <ArrowRight size={15} /></Link></div></section>; };

  return <div className="mx-auto max-w-7xl space-y-5"><section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-accent"><Swords size={15} /> {data.match.matchType} battle</p><h1 className="mt-2 text-3xl font-semibold text-white">{mode}</h1><p className="mt-1 text-sm text-muted">{data.match.status === "queue" ? "Searching for opponents..." : data.match.status === "invite" ? "Waiting for the opponent to accept." : data.match.status === "map_select" ? "Choose and confirm the battle map." : finished ? "Battle complete" : "Map battle"}</p></div>{data.match.status === "active" && countdown > 0 && <div className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-2xl font-bold text-accent">{countdown}</div>}</div></section>{data.match.status === "queue" ? <section className="rounded-3xl border border-border bg-surface/95 p-12 text-center shadow-glow"><Loader2 className="mx-auto animate-spin text-accent" size={34} /><h2 className="mt-5 text-xl font-semibold text-white">Finding your battle</h2><p className="mt-2 text-sm text-muted">{data.match.matchType === "ranked" ? "Waiting for players in your exact rank and tier." : "Waiting for players in your rank."}</p></section> : data.match.status === "invite" ? <Waiting /> : data.match.status === "map_select" ? <CasualMapSelection data={data} matchId={matchId} onRefresh={load} /> : waitingForOwnScore ? <><section className="mx-auto max-w-xl rounded-3xl border border-accent/20 bg-surface/95 p-8 text-center shadow-glow"><Avatar player={viewer} large /><p className="mt-5 text-xs uppercase tracking-[0.2em] text-accent">Your battle</p><h2 className="mt-2 text-2xl font-semibold text-white">{viewer?.displayName ?? viewer?.username}</h2><p className="mt-3 text-sm text-muted">Complete the battle map, then check your recent Rhythia score.</p></section><MapPanel /></> : finished ? <Result /> : <><section className="flex flex-col gap-5 lg:flex-row"><Team team={teamOne} label="Team 1" /><div className="flex items-center justify-center px-2 text-4xl font-black italic text-muted">VS</div><Team team={teamTwo} label="Team 2" /></section><MapPanel /></>}</div>;
}
