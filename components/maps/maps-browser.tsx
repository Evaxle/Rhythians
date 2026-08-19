"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Map as MapIcon, RefreshCw, Search, Trophy, XCircle } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { RANKS, isMapInRankRange, rhpGainForMap } from "@/lib/ranks";
import { MapLeaderboard } from "@/components/maps/map-leaderboard";

const PAGE_SIZE = 40;

type MapEntry = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  rating: number | null;
  rankIndex: number;
  rankName: string;
  rankColor: string;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  completion: { passed: boolean; points: number } | null;
  submittedBy: { displayName: string | null; username: string; profileHandle: string } | null;
  reviewedBy: { displayName: string | null; username: string; profileHandle: string } | null;
};

export function MapsBrowser({ maps, rankInfo, userRhp, currentUserId }: { maps: MapEntry[]; rankInfo: RankInfo; userRhp: number; currentUserId: string | null }) {
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, { tone: "ok" | "warn" | "err"; text: string }>>({});
  const [query, setQuery] = useState("");
  const [autoChecking, setAutoChecking] = useState(false);
  const [didAutoCheck, setDidAutoCheck] = useState(false);
  const [leaderboardId, setLeaderboardId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = showAll ? maps : maps.filter((map) => map.rating != null && isMapInRankRange(map.rating, rankInfo.index));
    const term = query.trim().toLowerCase();
    if (term) list = list.filter((map) => map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term));
    return list;
  }, [maps, showAll, rankInfo.index, query]);

  const visibleMaps = filtered.slice(0, visibleCount);
  const outOfRangeCount = maps.length - filtered.length;

  useEffect(() => {
    if (didAutoCheck || maps.length === 0) return;
    const toCheck = maps.filter((map) => map.rating != null && isMapInRankRange(map.rating, rankInfo.index) && !map.completion);
    if (toCheck.length === 0) return;
    let index = 0;
    async function run() {
      setAutoChecking(true);
      setDidAutoCheck(true);
      while (index < toCheck.length) {
        await checkMap(toCheck[index].id, true);
        index += 1;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      setAutoChecking(false);
    }
    void run();
  }, [maps, didAutoCheck, rankInfo.index]);

  async function checkMap(id: string, isAuto = false) {
    setBusyId(id);
    if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone: "ok", text: "Checking your scores..." } }));
    try {
      const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: id }) });
      const data = await response.json();
      if (!response.ok) {
        if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone: "err", text: data.error ?? "Unable to check your scores." } }));
        return;
      }
      const text = data.status === "beat"
        ? `You earned ${data.points} RHP!${data.accuracy != null ? ` (${data.accuracy.toFixed(2)}% accuracy)` : ""}`
        : data.status === "already"
          ? "You already earned RHP for this map."
          : data.status === "failed"
            ? `Attempt recorded. You lost ${Math.abs(data.points)} RHP.`
            : data.status === "out_of_range"
              ? "This map is outside your rank's rating range."
              : "No score found for this map yet.";
      const tone = data.status === "beat" || data.status === "already" ? "ok" : data.status === "failed" ? "warn" : "warn";
      if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone, text } }));
    } catch {
      if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone: "err", text: "Unable to reach the server. Try again." } }));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">Your rank: <span className="font-semibold" style={{ color: rankInfo.color }}>{rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`}</span> · {userRhp.toLocaleString()} RHP</p>
          <p className="mt-1 text-xs text-muted">Allowed rating range: <span className="font-semibold text-white">{rankInfo.rangeMin.toFixed(2)} – {rankInfo.rangeMax.toFixed(2)}</span></p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} className="h-4 w-4 accent-accent" />
          <span className="text-sm font-semibold text-white">Show all maps</span>
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search maps by title, artist, or mapper..." className="w-full rounded-full border border-border bg-surface/95 py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none" />
        </div>
        {autoChecking && <span className="inline-flex items-center gap-2 text-xs text-muted"><RefreshCw size={13} className="animate-spin" /> Auto-checking your scores...</span>}
      </div>

      {showAll && outOfRangeCount > 0 && <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Showing all {maps.length} maps ({outOfRangeCount} outside your rank). Maps outside your rank&apos;s rating range will <span className="font-semibold">not</span> earn you RHP.</p></div>}

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-background/50 p-10 text-center text-sm text-muted">{query.trim() ? `No maps match "${query.trim()}". Try a different search.` : "No maps available in your rank's rating range yet. Submit one for review or check back soon!"}</div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {visibleMaps.map((map) => {
              const message = messages[map.id];
              const rank = RANKS[map.rankIndex] ?? RANKS[RANKS.length - 1];
              const lengthLabel = map.length != null ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}` : null;
              return (
                <article key={map.id} className="flex flex-col rounded-3xl border-2 bg-surface/95 p-5 shadow-glow" style={{ borderColor: `${map.rankColor}99`, boxShadow: `0 0 28px ${map.rankColor}14` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted">{map.artist ?? "Unknown artist"}</p>
                      <h3 className="mt-1 truncate text-xl font-semibold text-white">{map.title}</h3>
                      <p className="mt-1 text-xs text-muted">Mapped by {map.mapperName ?? map.submittedBy?.displayName ?? "Unknown"}</p>
                    </div>
                    {map.rating != null && <div className="flex shrink-0 flex-col items-end gap-1"><span className="inline-flex rounded-full px-2.5 py-1 text-sm font-semibold" style={{ color: map.rankColor, border: `1px solid ${map.rankColor}80`, backgroundColor: `${map.rankColor}14` }}>{map.rating.toFixed(2)}</span><span className="text-[11px] font-semibold" style={{ color: map.rankColor }}>{rank.name}</span></div>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                    {map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}
                    {lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{lengthLabel}</span>}
                    <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">Rating: {map.rating != null ? map.rating.toFixed(2) : "—"}</span>
                  </div>

                  {map.rating != null && <p className="mt-3 inline-flex items-center gap-1.5 text-xs" style={{ color: map.rankColor }}><span className="font-semibold text-white">{rhpGainForMap(map.rating, 100, undefined, rankInfo.index).toLocaleString()} RHP</span><span className="text-muted">at 100% accuracy · {rhpGainForMap(map.rating, 100, 2, rankInfo.index).toLocaleString()} with a speed modifier</span></p>}

                  {map.reviewedBy && <p className="mt-3 text-xs text-muted">Approved by <Link href={`/profile/${map.reviewedBy.profileHandle}`} className="font-semibold text-white hover:text-accent">{map.reviewedBy.displayName ?? map.reviewedBy.username}</Link></p>}

                  {map.completion?.passed ? <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300"><CheckCircle2 size={16} /> Completed · {map.completion.points} RHP</div> : map.completion ? <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300"><XCircle size={16} /> Attempted · {map.completion.points} RHP</div> : null}

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    <a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"><Download size={15} /> Download</a>
                    <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-60"><RefreshCw size={15} className={busyId === map.id ? "animate-spin" : ""} />{busyId === map.id ? "Checking..." : "Check my score"}</button>
                    <button type="button" onClick={() => setLeaderboardId((current) => current === map.id ? null : map.id)} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"><Trophy size={15} /> Leaderboard</button>
                  </div>

                  {message && <p className={`mt-3 rounded-2xl border p-3 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : message.tone === "warn" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>{message.text}</p>}
                  {leaderboardId === map.id && <MapLeaderboard mapId={map.id} currentUserId={currentUserId} onClose={() => setLeaderboardId(null)} />}
                </article>
              );
            })}
          </div>
          {filtered.length > visibleMaps.length && <div className="flex justify-center pt-2"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/20"><ChevronDown size={16} /> Show more maps ({filtered.length - visibleMaps.length} remaining)</button></div>}
        </>
      )}

      <div className="flex justify-center pt-2"><Link href="/maps/submit" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><MapIcon size={16} /> Submit a map for review</Link></div>
    </div>
  );
}
