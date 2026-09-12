"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ChevronDown, ChevronUp, Download, ExternalLink, Trophy } from "lucide-react";
import { getRankInfo, mapTierForRating, RANKS, type RankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";
import { MapAnalysisTimeline } from "@/components/maps/map-analysis-timeline";
import type { RankedMapLeaderboard } from "@/lib/ranked-map-leaderboard";

type Props = { map: RankedMapLeaderboard; userRank: RankInfo; currentUserId: string };

function lengthLabel(length: number | null) {
  if (length == null) return null;
  const milliseconds = length > 10_000 ? length : length * 1000;
  return `${Math.floor(milliseconds / 60_000)}:${String(Math.round((milliseconds % 60_000) / 1000)).padStart(2, "0")}`;
}

export function MapDetail({ map, userRank: _userRank, currentUserId }: Props) {
  const [data, setData] = useState(map);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRankabilityDetails, setShowRankabilityDetails] = useState(false);

  useEffect(() => {
    if (!map.isRanked) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/maps/${map.mapId}/leaderboard`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Unable to load the leaderboard.");
        setData(body);
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to load the leaderboard.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [map.isRanked, map.mapId]);

  const length = useMemo(() => lengthLabel(data.length), [data.length]);
  const rank = getRankInfo(RANKS[data.rankIndex]?.minRhp ?? 0);
  const mapTier = mapTierForRating(data.rating);
  const mapDifficulty = data.rankIndex === RANKS.length - 1 ? "Expert" : `${data.rankName} ${mapTier}`;

  return <div className="space-y-8">
    <section className="overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-glow">
      {data.imageUrl && <img src={data.imageUrl} alt="" className="h-64 w-full object-cover opacity-80" />}
      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3"><RankIcon rank={rank} size={44} /><p className="text-sm uppercase tracking-[0.2em]" style={{ color: data.rankColor }}>{mapDifficulty}{data.isLegacy ? " · Legacy" : data.sourceStatus === "unranked" ? " · Unranked" : ""}</p></div>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{data.title}</h1>
            <p className="mt-2 text-sm text-muted">{data.artist ?? "Unknown artist"} · Mapped by {data.mapperName ?? "Unknown"}</p>
            {data.challengeAssignments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{data.challengeAssignments.map((entry) => <span key={`${entry.category}-${entry.level}`} className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold text-fuchsia-200">Challenge map · {entry.label} Level {entry.level}</span>)}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/maps/download?id=${encodeURIComponent(data.mapId)}`} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white"><Download size={15} /> Download map</a>
            {data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"><ExternalLink size={15} /> View on Rhythia</a>}
          </div>
        </div>

        <div className={`mt-6 grid gap-3 ${data.isRanked ? "sm:grid-cols-2 lg:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          <div className="rounded-2xl border border-accent/30 bg-accent/[0.08] p-4"><p className="text-xs uppercase tracking-wider text-muted">Rankability</p><p className="mt-1 text-3xl font-black text-white">{data.rankability.toFixed(2)}<span className="text-sm font-semibold text-muted"> / 5.00</span></p><p className="mt-1 text-xs leading-4 text-muted">Competitive balance and ranking suitability.</p><button type="button" onClick={() => setShowRankabilityDetails((v) => !v)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-accent">{showRankabilityDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{showRankabilityDetails ? "Hide details" : "View more details"}</button></div>
          <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Rating</p><p className="mt-1 text-xl font-semibold" style={{ color: data.rankColor }}>{data.rating.toFixed(2)}</p></div>
          {data.isRanked && <><div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">RPL</p><p className="mt-1 text-xl font-semibold text-white">{data.rpl}</p></div><div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">RPV</p><p className="mt-1 text-xl font-semibold text-white">{data.rpv}</p></div><div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">RPS</p><p className="mt-1 text-xl font-semibold text-white">{data.rps}</p></div></>}
          {data.isLegacy && <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Archive status</p><p className="mt-1 flex items-center gap-2 text-xl font-semibold text-white"><Archive size={18} /> Legacy</p></div>}
          <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Length</p><p className="mt-1 text-xl font-semibold text-white">{length ?? "—"}</p></div>
        </div>

        {showRankabilityDetails && <div className="mt-4 rounded-2xl border border-accent/25 bg-black/20 p-4 sm:p-5">
          <div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Rankability breakdown</p><h2 className="mt-1 text-xl font-bold text-white">Why this map received {data.rankability.toFixed(2)} / 5.00</h2></div><div className="text-right"><p className="text-xs text-muted">Raw score</p><p className="text-lg font-black text-white">{data.rankabilityDetails.rawScore.toFixed(2)}</p></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.rankabilityDetails.factors.map((item) => <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex justify-between gap-2"><p className="text-sm font-bold text-white">{item.label}</p><p className="text-sm font-black text-accent">{item.score.toFixed(2)} / 5</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent" style={{ width: `${item.score / 5 * 100}%` }} /></div><p className="mt-2 text-xs leading-5 text-muted">{item.reason}</p></div>)}</div>
          {data.rankabilityDetails.limitations.length > 0 && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3"><p className="text-xs font-bold uppercase text-amber-200">What holds it back</p>{data.rankabilityDetails.limitations.map((item) => <p key={item} className="mt-1 text-xs text-muted">• {item}</p>)}</div>}
        </div>}

        <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">{mapDifficulty}</span>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Rankability {data.rankability.toFixed(2)} / 5.00</span>
          {data.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">{data.noteCount.toLocaleString()} notes</span>}
          <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Analyzer v{data.analysis.analyzerVersion}</span>
        </div>
      </div>
    </section>

    <section className="ui-panel ui-panel-compact sm:p-8">
      <p className="text-sm uppercase tracking-[0.2em] text-fuchsia-300">Challenge category fit</p>
      <h2 className="mt-1 text-2xl font-semibold text-white">Category quality and estimated level</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">The 1–5 score measures how well the map represents each category, not how difficult it is. The level is a separate difficulty estimate for that category’s specific elements.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.challengeFits.map((item) => {
        const assigned = data.challengeAssignments.some((entry) => entry.category === item.category);
        return <div key={item.category} className={`rounded-2xl border p-4 ${assigned ? "border-fuchsia-400/40 bg-fuchsia-400/[0.08]" : "border-white/10 bg-black/15"}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{item.label}</p>{assigned && <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-fuchsia-300">Assigned challenge category</p>}</div><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-black text-white">Level {item.suggestedLevel}</span></div>
          <p className="mt-3 text-2xl font-black text-white">{item.score.toFixed(2)} <span className="text-xs text-muted">/ 5.00 fit</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-fuchsia-300" style={{ width: `${item.score / 5 * 100}%` }} /></div>
          <p className="mt-3 text-xs leading-5 text-muted">{item.reason}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{item.metrics.slice(0, 3).map((metric) => <span key={metric.label} className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-xs text-muted">{metric.label}: {metric.value}</span>)}</div>
        </div>;
      })}</div>
    </section>

    <MapAnalysisTimeline analysis={data.analysis} isLegacy={data.isLegacy} />

    {data.isRanked ? <section className="ui-panel ui-panel-compact sm:p-8">
      <div className="flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-accent"><Trophy size={16} /> Map leaderboard</p><h2 className="mt-1 text-2xl font-semibold text-white">{mapDifficulty} leaderboard</h2></div><Link href="/maps" className="text-sm font-semibold text-accent">Back to ranked maps</Link></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border">{loading ? <p className="p-8 text-sm text-muted">Loading leaderboard...</p> : error ? <p className="p-8 text-sm text-red-300">{error}</p> : data.rows.length === 0 ? <p className="p-8 text-sm text-muted">No current-rank scores are listed for this map.</p> : data.rows.map((row) => <div key={row.userId} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem] items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${row.userId === currentUserId ? "bg-accent/10" : "bg-background/60"}`}><span className="text-sm font-bold text-muted">{row.position}</span><Link href={`/profile/${row.profileHandle}`} className="truncate text-sm font-semibold text-white">{row.displayName ?? row.username}</Link><span className="text-right text-sm text-muted">{row.accuracy != null ? `${row.accuracy.toFixed(2)}%` : "—"}</span><span className="text-right text-sm font-semibold text-white">{row.points}</span></div>)}</div>
    </section> : <div className="flex justify-end"><Link href="/maps" className="text-sm font-semibold text-accent">Back to maps</Link></div>}
  </div>;
}
