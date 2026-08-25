"use client";

import { useState } from "react";
import Link from "next/link";
import { RANKS, type RankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";

export type ChallengeRow = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  rhp: number;
  avgMapRating: number | null;
  completions: number;
  rankInfo: RankInfo;
};

export function ChallengeLeaderboard({ leaderboards, currentUserId, initialRankIndex = 0, hideRankPicker = false }: { leaderboards: ChallengeRow[][]; currentUserId: string | null; initialRankIndex?: number; hideRankPicker?: boolean }) {
  const [selected, setSelected] = useState(initialRankIndex);
  const rows = leaderboards[selected] ?? [];
  const rank = RANKS[selected] ?? RANKS[0];
  const rankInfo: RankInfo = { index: rank.index, name: rank.name, tier: 1, isExpert: rank.index === RANKS.length - 1, minRhp: rank.minRhp, maxRhp: rank.index < RANKS.length - 1 ? rank.minRhp + 500 : null, tierStart: rank.minRhp, tierEnd: rank.minRhp + 100, nextTierStart: rank.minRhp + 100, nextRankStart: rank.index < RANKS.length - 1 ? rank.minRhp + 500 : null, color: rank.color, progressToNextTier: 0, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm uppercase tracking-[0.24em] text-accent">Ranked leaderboards</p><h2 className="mt-1 text-2xl font-semibold text-white">{hideRankPicker ? "Global" : "Pick a rank"}</h2></div>
        <p className="text-sm text-muted">Each leaderboard shows players ranked by RHP and map performance.</p>
      </div>
      {!hideRankPicker && <div className="flex flex-wrap gap-2">{RANKS.map((r, index) => {
        const info: RankInfo = { index, name: r.name, tier: 1, isExpert: index === RANKS.length - 1, minRhp: r.minRhp, maxRhp: index < RANKS.length - 1 ? r.minRhp + 500 : null, tierStart: r.minRhp, tierEnd: r.minRhp + 100, nextTierStart: r.minRhp + 100, nextRankStart: index < RANKS.length - 1 ? r.minRhp + 500 : null, color: r.color, progressToNextTier: 0, rangeMin: r.rangeMin, rangeMax: r.rangeMax };
        return <button key={r.name} type="button" onClick={() => setSelected(index)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === index ? "text-white" : "text-muted hover:text-white"}`} style={selected === index ? { borderColor: `${r.color}88`, backgroundColor: `${r.color}22`, color: r.color } : { borderColor: "var(--border, #2a2a3a)" }}><RankIcon rank={info} size={28} />{r.name}</button>;
      })}</div>}
      {!hideRankPicker && <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted"><RankIcon rank={rankInfo} size={34} /><span><span style={{ color: rank.color }} className="font-semibold">{rank.name}</span> range: {rank.rangeMin.toFixed(2)} – {rank.rangeMax.toFixed(2)} rating · {rank.minRhp.toLocaleString()}+ RHP</span></div>}
      <div className="overflow-hidden rounded-2xl border border-border">
        {rows.length === 0 ? <p className="p-8 text-sm text-muted">No players are in this leaderboard yet.</p> : rows.map((row) => {
          const isCurrentUser = row.userId === currentUserId;
          return <div key={row.userId} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6rem] ${isCurrentUser ? "bg-accent/10" : "bg-background/60"}`}>
            <span className="text-sm font-bold text-muted">{row.position}</span>
            <div className="flex min-w-0 items-center gap-3"><RankIcon rank={row.rankInfo} size={38} /><div className="min-w-0"><Link href={`/profile/${row.profileHandle}`} className={`truncate text-sm font-semibold hover:text-accent ${isCurrentUser ? "text-accent" : "text-white"}`}>{row.displayName ?? row.username}{isCurrentUser ? " (you)" : ""}</Link><p className="text-xs text-muted">{row.rankInfo.isExpert ? "Expert" : `${row.rankInfo.name} ${row.rankInfo.tier}`} · {row.completions} map{row.completions === 1 ? "" : "s"} beaten{row.avgMapRating != null ? ` · avg ${row.avgMapRating.toFixed(2)}` : ""}</p></div></div>
            <span className="hidden text-right text-sm text-muted sm:block">{row.avgMapRating != null ? `${row.avgMapRating.toFixed(2)} avg` : "—"}</span><span className="text-right text-sm font-semibold text-white">{row.rhp.toLocaleString()} RHP</span>
          </div>;
        })}
      </div>
    </section>
  );
}
