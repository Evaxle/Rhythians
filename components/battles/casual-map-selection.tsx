"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

const labels: Record<string, string> = { lower: "Lower rank", middle: "Average rank", higher: "Higher rank" };

export function CasualMapSelection({ data, matchId, onRefresh }: { data: any; matchId: string; onRefresh: () => Promise<void> }) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const options = data.options ?? [];
  const currentVote = (data.votes ?? []).find((vote: any) => vote.userId === data.viewerId)?.mapId;
  const voteCount = data.votes?.length ?? 0;
  const playerCount = data.players?.length ?? 0;
  const tally = new Map<string, number>();
  for (const vote of data.votes ?? []) tally.set(vote.mapId, (tally.get(vote.mapId) ?? 0) + 1);

  async function vote(mapId: string) {
    setVoting(true);
    setError("");
    try {
      const response = await fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "vote-map", matchId, mapId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not submit map vote.");
      if (result.selectedMapId) {
        setWinnerId(result.selectedMapId);
        await new Promise((resolve) => setTimeout(resolve, 1600));
      }
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit map vote.");
    } finally {
      setVoting(false);
    }
  }

  return <section className="rounded-[2rem] border border-accent/20 bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-accent"><Sparkles size={15} /> Casual map vote</p><h2 className="mt-2 text-2xl font-semibold text-white">Pick the battle map</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Three maps are balanced around the matchup: lower rank, average rank, and higher rank. Every player gets one vote. A tie is broken randomly.</p></div><span className="rounded-full border border-white/10 bg-black/15 px-4 py-2 text-xs font-semibold text-muted">{voteCount}/{playerCount} voted</span></div><div className="mt-6 grid gap-4 md:grid-cols-3">{options.map((option: any) => { const selected = currentVote === option.mapId; const winner = winnerId === option.mapId; const count = tally.get(option.mapId) ?? 0; return <button key={option.id} disabled={voting || Boolean(winnerId)} onClick={() => void vote(option.mapId)} className={`group relative overflow-hidden rounded-3xl border text-left transition duration-500 ${winner ? "scale-[1.03] border-emerald-300 bg-emerald-400/15 shadow-[0_0_60px_rgba(110,231,183,0.22)]" : selected ? "border-accent bg-accent/10" : "border-white/10 bg-background/40 hover:-translate-y-1 hover:border-accent/30"}`}><div className="relative aspect-[4/3] overflow-hidden bg-white/5">{option.imageUrl ? <img src={option.imageUrl} alt="" className={`h-full w-full object-cover transition duration-700 ${winner ? "scale-110" : "group-hover:scale-105"}`} /> : <div className="flex h-full w-full items-center justify-center text-muted">No image</div>}{winner && <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]"><div className="rounded-full border border-emerald-200/40 bg-emerald-300/20 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-emerald-100 animate-pulse">Map selected</div></div>}<span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white backdrop-blur">{labels[option.bucket] ?? option.bucket}</span><span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">{count} vote{count === 1 ? "" : "s"}</span></div><div className="p-4"><p className="truncate text-lg font-semibold text-white">{option.title}</p><p className="mt-1 truncate text-xs text-muted">{option.artist ?? "Unknown artist"}{option.rating != null ? ` · ${Number(option.rating).toFixed(2)}★` : ""}</p><div className="mt-4 flex items-center justify-between text-xs"><span className="text-muted">{Number(option.length ?? 0) > 0 ? `${Math.floor(Number(option.length) / 60)}:${String(Math.floor(Number(option.length) % 60)).padStart(2, "0")}` : "Length unknown"}</span>{selected && <span className="inline-flex items-center gap-1 font-semibold text-accent"><Check size={13} /> Your vote</span>}</div></div></button>; })}</div>{voteCount < playerCount && <p className="mt-5 text-center text-xs text-muted">The battle begins as soon as everyone votes.</p>}{voting && <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={16} /> Recording vote...</p>}{error && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}</section>;
}
