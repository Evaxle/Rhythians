"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { isMapInRankRange, rhpGainForMap } from "@/lib/ranks";

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
  hasScore: boolean;
  submittedBy: { displayName: string | null; username: string; profileHandle: string } | null;
  reviewedBy: { displayName: string | null; username: string; profileHandle: string } | null;
  isRanked: boolean;
};

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

function extensionFromUrl(url: string) {
  try {
    const match = new URL(url).pathname.match(/(\.[a-z0-9]{2,8})$/i);
    return match?.[1] ?? ".sspm";
  } catch {
    return ".sspm";
  }
}

export function MapsBrowser({ maps, rankInfo, userRhp }: { maps: MapEntry[]; rankInfo: RankInfo; userRhp: number; currentUserId: string | null }) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    let list = showAll ? maps : maps.filter((map) => !map.isRanked || (map.rating != null && isMapInRankRange(map.rating, rankInfo.index)));
    const term = query.trim().toLowerCase();
    if (term) list = list.filter((map) => map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term));
    return list;
  }, [maps, showAll, rankInfo.index, query]);

  const visibleMaps = filtered.slice(0, visibleCount);
  const rankedMaps = maps.filter((map) => map.isRanked && map.mapFileUrl);
  const rankMaps = rankedMaps.filter((map) => map.rating != null && isMapInRankRange(map.rating, rankInfo.index));
  const outOfRangeCount = maps.filter((map) => map.isRanked).length - filtered.filter((map) => map.isRanked).length;

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: "Checking your score..." }));
    try {
      const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your score.");
      setMessages((current) => ({ ...current, [id]: data.status === "beat" ? `You earned ${data.points} RHP${data.accuracy != null ? ` · ${data.accuracy.toFixed(2)}% accuracy` : ""}.` : data.status === "already" ? "You already earned RHP for this map." : data.status === "failed" ? `Attempt recorded. You lost ${Math.abs(data.points)} RHP.` : data.status === "out_of_range" ? "This map is outside your rank's rating range." : "No score found for this map yet." }));
    } catch (error) {
      setMessages((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Unable to check your score." }));
    } finally {
      setBusyId("");
    }
  }

  async function downloadRankMaps() {
    if (!rankMaps.length) return;
    setMessages((current) => ({ ...current, __download: `Downloading ${rankMaps.length} ranked maps...` }));
    const failures: string[] = [];
    const files: Array<{ name: string; data: Uint8Array }> = [];
    for (const map of rankMaps) {
      try {
        const response = await fetch(map.mapFileUrl, { mode: "cors", cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        files.push({ name: `${safeName(map.title)}${extensionFromUrl(map.mapFileUrl)}`, data: new Uint8Array(await response.arrayBuffer()) });
      } catch (error) {
        failures.push(`${map.title}: ${error instanceof Error ? error.message : "download failed"}`);
      }
    }
    if (!files.length) {
      setMessages((current) => ({ ...current, __download: "Could not fetch the map files. Use the individual Download buttons." }));
      return;
    }
    const archive = new Blob(files.map((file) => file.data), { type: "application/octet-stream" });
    const url = URL.createObjectURL(archive);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${rankInfo.isExpert ? "Expert" : rankInfo.name}-maps.bin`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessages((current) => ({ ...current, __download: `Downloaded ${files.length} ranked map files${failures.length ? ` · ${failures.length} failed` : ""}.` }));
  }

  return <div className="space-y-6"><div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-muted">Your rank: <span className="font-semibold" style={{ color: rankInfo.color }}>{rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`}</span> · {userRhp.toLocaleString()} RHP</p><p className="mt-1 text-xs text-muted">Allowed rating range: <span className="font-semibold text-white">{rankInfo.rangeMin.toFixed(2)} – {rankInfo.rangeMax.toFixed(2)}</span></p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void downloadRankMaps()} disabled={!rankMaps.length} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download size={15} /> Download ranked maps</button><label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} className="h-4 w-4 accent-accent" /><span className="text-sm font-semibold text-white">Show all maps</span></label></div></div>{messages.__download && <p className="rounded-2xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{messages.__download}</p>}<div className="relative"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search maps by title, artist, or mapper..." className="w-full rounded-full border border-border bg-surface/95 py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none" /></div>{showAll && outOfRangeCount > 0 && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">Showing ranked maps outside your rank&apos;s rating range. Those maps do not award RHP.</div>}{filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-border bg-background/50 p-10 text-center text-sm text-muted">{query.trim() ? `No maps match "${query.trim()}".` : "No maps are available."}</div> : <div className="grid gap-5 lg:grid-cols-2">{visibleMaps.map((map) => { const message = messages[map.id]; const scored = map.isRanked && (map.hasScore || Boolean(map.completion?.passed)); const lengthLabel = map.length != null ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}` : null; return <article key={map.id} className="flex flex-col rounded-3xl border-2 bg-surface/95 p-5 shadow-glow" style={{ borderColor: map.isRanked ? (scored ? "#34d399" : `${map.rankColor}99`) : "#f59e0b80" }}><div className="flex items-start justify-between gap-3"><Link href={`/maps/${map.id}`} className="min-w-0"><p className="text-sm text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 truncate text-xl font-semibold text-white hover:text-accent">{map.title}</h3><p className="mt-1 text-xs text-muted">Mapped by {map.mapperName ?? map.submittedBy?.displayName ?? "Unknown"}</p></Link>{map.rating != null && <div className="flex shrink-0 flex-col items-end gap-1"><span className="inline-flex rounded-full px-2.5 py-1 text-sm font-semibold" style={{ color: map.isRanked ? map.rankColor : "#f59e0b", border: `1px solid ${map.isRanked ? `${map.rankColor}80` : "#f59e0b80"}`, backgroundColor: `${map.isRanked ? map.rankColor : "#f59e0b"}14` }}>{map.rating.toFixed(2)}</span><span className="text-[11px] font-semibold" style={{ color: map.isRanked ? map.rankColor : "#f59e0b" }}>{map.isRanked ? map.rankName : "Unranked"}</span></div>}</div><Link href={`/maps/${map.id}`} className="mt-3 block"><div className="flex flex-wrap gap-2 text-xs text-muted">{!map.isRanked && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-semibold text-amber-200">Unranked</span>}{scored && <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-300">Score found</span>}{map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}{lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{lengthLabel}</span>}<span className="rounded-full border border-border bg-background/60 px-2.5 py-1">Rating: {map.rating != null ? map.rating.toFixed(2) : "—"}</span></div>{map.isRanked && map.rating != null && <p className="mt-3 text-xs" style={{ color: map.rankColor }}><span className="font-semibold text-white">{rhpGainForMap(map.rating, 100, undefined, rankInfo.index, map.length ? map.length / 1000 : null).toLocaleString()} RHP</span> at 100% accuracy</p>}</Link><div className="mt-auto flex flex-wrap gap-2 pt-5"><a href={map.mapFileUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white"><Download size={15} /> Download {extensionFromUrl(map.mapFileUrl).replace(".", "").toUpperCase()}</a>{map.isRanked && <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === map.id ? "Checking..." : "Check my score"}</button>}</div>{message && <p className="mt-3 rounded-2xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{message}</p>}{map.reviewedBy && <p className="mt-3 text-xs text-muted">Approved by <Link href={`/profile/${map.reviewedBy.profileHandle}`} className="font-semibold text-white hover:text-accent">{map.reviewedBy.displayName ?? map.reviewedBy.username}</Link></p>}</article>; })}</div>}{filtered.length > visibleMaps.length && <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="rounded-full border border-accent/40 bg-accent/10 px-6 py-2.5 text-sm font-semibold text-white">Show more maps ({filtered.length - visibleMaps.length} remaining)</button></div>}</div>;
}
