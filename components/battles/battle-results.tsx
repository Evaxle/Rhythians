"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Loader2, Play, Swords, Trophy } from "lucide-react";

export function BattleResults({ matchId }: { matchId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  async function load() {
    try {
      const response = await fetch(`/api/battles/matches?id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load results.");
      setData(result);
      setError("");
      setVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results.");
    }
  }

  useEffect(() => { void load(); }, [matchId]);

  if (!data) return <div className="ui-page min-h-[70vh] flex items-center justify-center"><div className="text-muted"><Loader2 className="mr-2 inline animate-spin" size={18} />{error || "Loading results..."}</div></div>;
  const players = data.players ?? [];
  const winnerTeam = data.teamScores?.winner ?? 0;
  const viewer = players.find((player: any) => player.userId === data.viewerId);
  const winner = winnerTeam === 1 ? players.filter((player: any) => player.team === 1) : winnerTeam === 2 ? players.filter((player: any) => player.team === 2) : [];
  const winnerAccuracy = winner.length ? winner.reduce((sum: number, player: any) => sum + Number(player.accuracy ?? 0), 0) / winner.length : null;
  const viewerAwards = (data.rbpAwards ?? []).filter((award: any) => award.userId === data.viewerId);
  const viewerResults = (data.rbpResult ?? []).filter((result: any) => result.userId === data.viewerId);
  const rbpChange = viewerAwards.reduce((sum: number, award: any) => sum + Number(award.delta ?? 0), 0) + viewerResults.reduce((sum: number, result: any) => sum + Number(result.delta ?? 0), 0);
  const viewerResult = viewerResults[0]?.result ?? (winnerTeam === 0 ? "draw" : viewer?.team === winnerTeam ? "win" : "loss");
  const resultLabel = viewerResult === "win" ? "Victory" : viewerResult === "loss" ? "Defeat" : viewerResult === "forfeit" ? "Forfeit" : "Draw";
  return <div className="ui-page flex min-h-[75vh] items-center justify-center"><section className={`w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-surface/95 p-7 text-center shadow-glow transition duration-700 sm:p-10 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 text-accent"><Trophy size={30} /></div><p className="mt-6 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-accent"><Swords size={15} /> {data.match.matchType} {String(data.match.mode).split(":")[0]} result</p><h1 className="mt-3 text-5xl font-black tracking-[-0.05em] text-white sm:text-6xl">{resultLabel}</h1>{winnerTeam === 0 ? <p className="mt-4 text-lg text-muted">The battle ended in a draw.</p> : <><div className="mx-auto mt-8 flex max-w-xl flex-col items-center rounded-3xl border border-accent/20 bg-accent/[0.06] p-7"><Crown className="text-accent" size={28} /><p className="mt-4 text-xs uppercase tracking-[0.2em] text-accent">Winner</p><div className="mt-3 flex flex-wrap justify-center gap-3">{winner.map((player: any) => <div key={player.userId} className="rounded-2xl border border-white/10 bg-black/15 px-5 py-4"><p className="text-xl font-bold text-white">{player.displayName ?? player.username}</p><p className="mt-1 text-2xl font-black tabular-nums text-accent">{Number(player.accuracy ?? 0).toFixed(2)}%</p></div>)}</div>{winnerAccuracy != null && winner.length > 1 && <p className="mt-4 text-sm text-muted">Team average {winnerAccuracy.toFixed(2)}%</p>}</div></>}<div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Your score</p><p className="mt-2 text-2xl font-black text-white">{viewer?.accuracy != null ? `${Number(viewer.accuracy).toFixed(2)}%` : "—"}</p></div>{data.match.matchType === "ranked" && <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">RBP change</p><p className={`mt-2 text-2xl font-black ${rbpChange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{rbpChange > 0 ? "+" : ""}{rbpChange} RBP</p></div>}</div>{viewerResult === "forfeit" && <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">10 RBP lost for unsportsmanlike conduct.</p>}{viewerResults[0]?.reason === "opponent_forfeit" && <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">Your opponent forfeited. You received 10 RBP.</p>}<div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/battles" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"><ArrowLeft size={16} /> Leave</Link><Link href="/battles" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent2"><Play size={16} /> Play again</Link></div></section></div>;
}
