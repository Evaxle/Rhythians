"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Trophy } from "lucide-react";
import { RANKS, rhpGainForMap, type RankInfo } from "@/lib/ranks";
import type { RankedMapLeaderboard } from "@/lib/ranked-map-leaderboard";

type Props = {
  map: RankedMapLeaderboard;
  userRank: RankInfo;
  currentUserId: string;
};

function rankLabel(index: number) {
  return RANKS[index]?.name ?? "Unknown";
}

function lengthLabel(length: number | null) {
  if (length == null) return null;
  return `${Math.floor(length / 60_000)}:${String(Math.round((length % 60_000) / 1000)).padStart(2, "0")}`;
}

export function MapDetail({ map, userRank, currentUserId }: Props) {
  const [selectedRank, setSelectedRank] = useState(userRank.index);
  const [data, setData] = useState(map);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const rankQuery = selectedRank < 0 ? "all" : String(selectedRank);
    fetch(`/api/maps/${map.mapId}/leaderboard?rank=${rankQuery}`, { signal: controller.signal })
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
  }, [map.mapId, selectedRank]);

  const length = useMemo(() => lengthLabel(data.length), [data.length]);
  const baseRhp = rhpGainForMap(data.rating, 100, null, data.rankIndex, data.length == null ? null : data.length / 1000);
  const downloadUrl = `/api/maps/download?id=${encodeURIComponent(data.mapId)}`;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-glow">
        {data.imageUrl && <img src={data.imageUrl} alt="" className="h-64 w-full object-cover opacity-80" />}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.2em]" style={{ color: data.rankColor }}>{data.rankName}</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{data.title}</h1>
              <p className="mt-2 text-sm text-muted">{data.artist ?? "Unknown artist"} · Mapped by {data.mapperName ?? "Unknown"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={downloadUrl} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"><Download size={15} /> Download map</a>
              {data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40"><ExternalLink size={15} /> View on Rhythia</a>}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Rating</p><p className="mt-1 text-xl font-semibold" style={{ color: data.rankColor }}>{data.rating.toFixed(2)}</p></div>
            <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Rank range</p><p className="mt-1 text-xl font-semibold text-white">{data.rangeMin.toFixed(2)}–{data.rangeMax.toFixed(2)}</p></div>
            <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">100% RHP</p><p className="mt-1 text-xl font-semibold text-white">{baseRhp}</p></div>
            <div className="rounded-2xl border border-border bg-background/60 p-4"><p className="text-xs uppercase tracking-wider text-muted">Length</p><p className="mt-1 text-xl font-semibold text-white">{length ?? "—"}</p></div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
            {data.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">{data.noteCount.toLocaleString()} notes</span>}
            {data.sourceBeatmapId != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Rhythia map #{data.sourceBeatmapId}</span>}
            <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">Rhythians ID: {data.mapId}</span>
            <span className="rounded-full border border-border bg-background/60 px-3 py-1.5">RHP is awarded only when this map is in your current rank range</span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-accent"><Trophy size={16} /> Map leaderboard</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Best scores by current rank</h2>
            <p className="mt-2 text-sm text-muted">A score automatically moves with its owner&apos;s current RHP rank. When a player ranks up, they disappear from the lower-rank board.</p>
          </div>
          <Link href="/maps" className="text-sm font-semibold text-accent hover:text-white">Back to ranked maps</Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedRank(-1)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedRank === -1 ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>All ranks</button>
          {RANKS.map((rank, index) => <button key={rank.name} type="button" onClick={() => setSelectedRank(index)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedRank === index ? "text-white" : "text-muted hover:text-white"}`} style={selectedRank === index ? { borderColor: `${rank.color}88`, backgroundColor: `${rank.color}22`, color: rank.color } : { borderColor: "var(--border, #2a2a3a)" }}>{rank.name}</button>)}
        </div>

        {selectedRank >= 0 && <p className="mt-4 text-xs text-muted">Showing {rankLabel(selectedRank)} users, determined from their current RHP.</p>}

        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          {loading ? <p className="p-8 text-sm text-muted">Loading leaderboard...</p> : error ? <p className="p-8 text-sm text-red-300">{error}</p> : data.rows.length === 0 ? <p className="p-8 text-sm text-muted">No passing scores are currently listed for this rank.</p> : data.rows.map((row) => {
            const current = row.userId === currentUserId;
            return <div key={row.userId} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem] items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${current ? "bg-accent/10" : "bg-background/60"}`}>
              <span className="text-sm font-bold text-muted">{row.position}</span>
              <div className="flex min-w-0 items-center gap-3">
                {row.avatar ? <img src={row.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border" /> : <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold" style={{ color: row.rankInfo.color, borderColor: `${row.rankInfo.color}55`, backgroundColor: `${row.rankInfo.color}18` }}>{row.rankInfo.isExpert ? "#" : row.rankInfo.tier}</span>}
                <div className="min-w-0"><Link href={`/profile/${row.profileHandle}`} className={`truncate text-sm font-semibold hover:text-accent ${current ? "text-accent" : "text-white"}`}>{row.displayName ?? row.username}{current ? " (you)" : ""}</Link><p className="text-xs text-muted">{row.rankInfo.isExpert ? "Expert" : `${row.rankInfo.name} ${row.rankInfo.tier}`}</p></div>
              </div>
              <span className="text-right text-sm text-muted">{row.accuracy != null ? `${row.accuracy.toFixed(2)}%` : "—"}</span>
              <span className="text-right text-sm font-semibold text-white">{row.points} RHP</span>
            </div>;
          })}
        </div>

        <p className="mt-4 text-xs text-muted">Your score does not create a legacy Challenge Map completion. Ranked-map scores are stored separately from challenge progression.</p>
      </section>
    </div>
  );
}
