"use client";

import Link from "next/link";
import { ArrowLeft, Crown, Swords, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

export function BattleHistoryApp() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/battles/matches?history=1", { cache: "no-store" }).then((response) => response.json()).then((data) => setMatches(data.matches ?? [])).finally(() => setLoading(false));
  }, []);

  return <div className="mx-auto max-w-5xl space-y-5"><div className="flex items-center justify-between"><Link href="/battles" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"><ArrowLeft size={16} /> Battles</Link><div className="flex items-center gap-2 text-accent"><Trophy size={18} /><span className="text-sm font-semibold">Battle history</span></div></div><section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><h1 className="text-3xl font-semibold text-white">Your battles</h1><p className="mt-2 text-sm text-muted">Completed battles, results, maps, and team scores.</p><div className="mt-6 space-y-3">{loading ? <div className="p-10 text-center text-sm text-muted">Loading history...</div> : matches.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">No completed battles yet.</div> : matches.map((match) => <Link key={match.id} href={`/battles/match/${match.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-background/40 p-4 transition hover:border-accent/40 hover:bg-white/[0.03]"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><Swords size={19} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-white">{match.mode}</p><span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted">{match.matchType}</span>{match.teamMode === "captains" && <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">Captain&apos;s Choice</span>}</div><p className="mt-1 truncate text-xs text-muted">{match.mapTitle ?? "Battle map"} · {match.playerCount} players</p></div><div className="text-right"><p className="text-xs text-muted">{match.finishedAt ? new Date(match.finishedAt).toLocaleDateString() : ""}</p><p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent"><Crown size={12} /> Completed</p></div></Link>)}</div></section></div>;
}
