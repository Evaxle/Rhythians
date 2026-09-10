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
    setError("");
    fetch(`/api/maps/${map.mapId}/leaderboard`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Unable to load the leaderboard.");
        setData(body);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load the leaderboard.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [map.isRanked, map.mapId]);

  const length = useMemo(() => lengthLabel(data.length), [data.length]);
  const downloadUrl = `/api/maps/download?id=${encodeURIComponent(data.mapId)}`;
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
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={downloadUrl} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"><Download size={15} /> Download map</a>
            {data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40"><ExternalLink size={15} /> View on Rhythia</a>}
          </div>
        </div>

        <div className={`mt-6 grid gap-3 ${data.isRanked ? "sm:grid-cols-2 lg:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          <div className="rounded-2xl border border-accent/30 bg-accent/[0.08] p-4"><p className="text-xs uppercase tracking-wider text-muted">Rankability</p><p className="mt-1 text-3xl font-black text-white">{data.rankability.toFixed(2)}<span className="text-sm font-semibold text-muted"> / 5.00</span></p><p className="mt-1 text-[11px] leading-4 text-muted">Competitive ranking suitability from the current analysis.</p><button type="button" onClick={() => setShowRankabilityDetails((value) => !value)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-white">{showRankabilityDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{showRankabilityDetails ? "Hide details" : "View more details"}</button></div>
          <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Rating</p><p className="mt-1 text-xl font-semibold" style={{ color: data.rankColor }}>{data.rating.toFixed(2)}</p></div>
          {data.isRanked && <><div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">RPL</p><p className="mt-1 text-xl font-semibold text-white">{data.rpl}</p></div><div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">RPV</p><p className="mt-1 text-xl font-semibold text-white">{data.rpv}</p></div><div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">RPS</p><p className="mt-1 text-xl font-semibold text-white">{data.rps}</p></div></>}
          {data.isLegacy && <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Archive status</p><p className="mt-1 flex items-center gap-2 text-xl font-semibold text-white"><Archive size={18} /> Legacy</p></div>}
          {data.sourceStatus === "unranked" && <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Map status</p><p className="mt-1 text-xl font-semibold text-white">Unranked</p></div>}
          <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Length</p><p className="mt-1 text-xl font-semibold text-white">{length ?? "—"}</p></div>
        </div>

        {showRankabilityDetails && <div className="mt-4 rounded-2xl border border-accent/25 bg-black/20 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Rankability breakdown</p><h2 className="mt-1 text-xl font-bold text-white">Why this map received {data.rankability.toFixed(2)} / 5.00</h2></div><div className="text-right"><p className="text-xs text-muted">Raw analysis score</p><p className="text-lg font-black text-white">{data.rankabilityDetails.rawScore.toFixed(2)} / 5.00</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.rankabilityDetails.factors.map((factor) => <div key={factor.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-white">{factor.label}</p><p className="text-sm font-black text-accent">{factor.score.toFixed(2)} / 5.00</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, factor.score / 5 * 100))}%` }} /></div><p className="mt-2 text-[11px] leading-5 text-muted">Weight {(factor.weight * 100).toFixed(0)}% · contribution +{factor.contribution.toFixed(2)}</p><p className="mt-1 text-[11px] leading-5 text-muted">{factor.reason}</p></div>)}</div>{data.rankabilityDetails.strengths.length > 0 && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Why it scores higher</p><div className="mt-2 space-y-1 text-xs text-muted">{data.rankabilityDetails.strengths.map((item) => <p key={item}>• {item}</p>)}</div></div>}{data.rankabilityDetails.limitations.length > 0 && <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3"><p className="text-xs font-bold uppercase tracking-wider text-amber-200">Why it is not higher</p><div className="mt-2 space-y-1 text-xs leading-5 text-muted">{data.rankabilityDetails.limitations.map((item) => <p key={item}>• {item}</p>)}</div></div>}<p className="mt-3 text-[11px] leading-5 text-muted">Rankability is separate from difficulty rating. It measures whether the map has enough representative, consistent, analyzable gameplay to be suitable for competitive ranking. This score does not rank or unrank the map.</p></div>}

        <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">{mapDifficulty}</span>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Rankability {data.rankability.toFixed(2)} / 5.00</span>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Rank range {data.rangeMin.toFixed(2)}–{data.rankIndex === RANKS.length - 1 ? `${data.rangeMin.toFixed(2)}+` : data.rangeMax.toFixed(2)}</span>
          {data.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">{data.noteCount.toLocaleString()} notes</span>}
          {data.sourceBeatmapId != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Rhythia map #{data.sourceBeatmapId}</span>}
          <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Analyzer v{data.analysis.analyzerVersion}</span>
        </div>
      </div>
    </section>

    <MapAnalysisTimeline analysis={data.analysis} isLegacy={data.isLegacy} />

    {data.isRanked ? <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-accent"><Trophy size={16} /> Map leaderboard</p><h2 className="mt-1 flex items-center gap-3 text-2xl font-semibold text-white"><RankIcon rank={rank} size={40} />{mapDifficulty} leaderboard</h2><p className="mt-2 text-sm text-muted">Only players currently in this map&apos;s rank appear. Moving ranks hides the leaderboard entry while preserving the score and completion.</p></div>
        <Link href="/maps" className="text-sm font-semibold text-accent hover:text-white">Back to ranked maps</Link>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        {loading ? <p className="p-8 text-sm text-muted">Loading leaderboard...</p> : error ? <p className="p-8 text-sm text-red-300">{error}</p> : data.rows.length === 0 ? <p className="p-8 text-sm text-muted">No current-rank scores are listed for this map.</p> : data.rows.map((row) => {
          const current = row.userId === currentUserId;
          return <div key={row.userId} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem] items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${current ? "bg-accent/10" : "bg-background/60"}`}><span className="text-sm font-bold text-muted">{row.position}</span><div className="flex min-w-0 items-center gap-3"><RankIcon rank={row.rankInfo} size={38} /><div className="min-w-0"><Link href={`/profile/${row.profileHandle}`} className={`truncate text-sm font-semibold hover:text-accent ${current ? "text-accent" : "text-white"}`}>{row.displayName ?? row.username}{current ? " (you)" : ""}</Link><p className="text-xs text-muted">{row.rankInfo.isExpert ? "Expert" : `${row.rankInfo.name} ${row.rankInfo.tier}`}</p></div></div><span className="text-right text-sm text-muted">{row.accuracy != null ? `${row.accuracy.toFixed(2)}%` : "—"}</span><span className="text-right text-sm font-semibold text-white">{row.points}</span></div>;
        })}
      </div>
    </section> : <div className="flex justify-end"><Link href="/maps" className="text-sm font-semibold text-accent hover:text-white">Back to maps</Link></div>}
  </div>;
}
