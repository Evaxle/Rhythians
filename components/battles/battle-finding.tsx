"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Swords, UserRound } from "lucide-react";
import { getRankInfo, rankLabel } from "@/lib/ranks";

function Avatar({ player }: { player: any }) {
  if (player?.avatar) return <img src={player.avatar} alt={player.username} className="h-20 w-20 rounded-full border border-white/10 object-cover" />;
  return <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"><UserRound size={30} /></div>;
}

export function BattleFinding({ matchId }: { matchId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  async function load() {
    try {
      const response = await fetch(`/api/battles/matches?id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Battle not found.");
      setData(result);
      setError("");
      if (["active", "map_vote", "finished"].includes(result.match.status)) window.location.href = result.match.status === "finished" ? `/battles/match/${matchId}/results` : `/battles/match/${matchId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find battle.");
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => { setNow(Date.now()); void load(); }, 1000);
    return () => clearInterval(timer);
  }, [matchId]);

  if (error && !data) return <div className="ui-page max-w-4xl"><section className="ui-card rounded-[2rem] p-10 text-center"><p className="text-red-300">{error}</p><Link href="/battles" className="mt-5 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">Back to battles</Link></section></div>;
  const players = data?.players ?? [];
  const viewer = players.find((player: any) => player.userId === data?.viewerId) ?? players[0];
  const opponents = players.filter((player: any) => player.userId !== data?.viewerId);
  const rank = viewer ? getRankInfo(Number(viewer.rhp)) : null;
  const ready = opponents.length > 0;
  const seconds = Math.max(0, Math.floor((now - new Date(data?.match?.createdAt ?? Date.now()).getTime()) / 1000));
  return <div className="ui-page space-y-5"><section className="rounded-[2rem] border border-accent/15 bg-surface/95 p-6 shadow-glow sm:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-accent"><Swords size={15} /> Battle matchmaking</p><h1 className="mt-3 text-4xl font-semibold text-white">Finding opponent</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Your side stays on the left. We only connect ranked players inside the same RHP rank and casual players within one rank.</p></div><div className="rounded-2xl border border-white/10 bg-black/15 px-5 py-3 text-right"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Searching</p><p className="mt-1 text-lg font-semibold text-white tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p></div></div></section><section className="grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr]"><div className="ui-card rounded-[2rem] border border-accent/25 p-7"><p className="text-xs uppercase tracking-[0.18em] text-accent">You</p><div className="mt-8 flex flex-col items-center text-center"><Avatar player={viewer} /><h2 className="mt-4 text-2xl font-semibold text-white">{viewer?.displayName ?? viewer?.username ?? "You"}</h2>{rank && <span className="mt-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ color: rank.color, borderColor: `${rank.color}55` }}>{rankLabel(rank)}</span>}</div></div><div className="flex items-center justify-center"><div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-2xl font-black italic text-accent">VS</div></div><div className="ui-card rounded-[2rem] border border-white/10 p-7"><p className="text-xs uppercase tracking-[0.18em] text-muted">Opponent</p>{ready ? <div className="mt-8 flex flex-wrap justify-center gap-4">{opponents.map((player: any) => { const opponentRank = getRankInfo(Number(player.rhp)); return <div key={player.userId} className="flex min-w-[150px] flex-col items-center text-center"><Avatar player={player} /><p className="mt-4 text-lg font-semibold text-white">{player.displayName ?? player.username}</p><span className="mt-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ color: opponentRank.color, borderColor: `${opponentRank.color}55` }}>{rankLabel(opponentRank)}</span></div>; })}</div> : <div className="mt-8 flex flex-col items-center text-center"><div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/15 bg-black/10 text-4xl font-black text-muted"><span className="animate-pulse">?</span></div><Loader2 className="mt-5 animate-spin text-accent" size={20} /><p className="mt-3 text-sm text-muted">Waiting for a compatible opponent...</p></div>}</div></section></div>;
}
