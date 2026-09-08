"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Glasses, LockKeyhole, Search, Sparkles, XCircle } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { getRankInfo, isMapInRankRange, RANKS } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";
import type { MapModeTab, ModeScoreMap } from "@/components/maps/maps-sort-controls-persisted";

const PAGE_SIZE = 40;
const MODE_META = {
  lock: { short: "RPL", label: "Lock", max: 25, icon: LockKeyhole },
  spin: { short: "RPS", label: "Spin", max: 30, icon: Sparkles },
  vr: { short: "RPV", label: "VR", max: 23, icon: Glasses },
} as const;
type ModeKey = keyof typeof MODE_META;
type MapEntry = { id: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number | null; rankIndex: number; rankName: string; rankColor: string; mapperName: string | null; noteCount: number | null; length: number | null; completion: { passed: boolean; points: number } | null; hasScore: boolean; submittedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; reviewedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; isRanked: boolean; isLegacy: boolean };
type Props = { maps: MapEntry[]; rankInfo: RankInfo; userRhp: number; currentUserId: string | null; showLegacy?: boolean; onShowLegacyChange?: (value: boolean) => void; modeScores: ModeScoreMap; modeTab?: MapModeTab };

function titleKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function lengthLabel(length: number | null) { if (length == null) return null; const seconds = length > 10_000 ? Math.round(length / 1000) : Math.round(length); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function labelRank(rank: RankInfo) { return rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`; }

function ModeChip({ mode, score, eligible, active }: { mode: ModeKey; score: number; eligible: boolean; active: boolean }) {
  const meta = MODE_META[mode]; const Icon = meta.icon; const completed = score > 0;
  return <div className={`rounded-xl border px-2.5 py-2 ${eligible ? completed ? "border-emerald-400/25 bg-emerald-400/[0.08]" : active ? "border-accent/35 bg-accent/[0.08]" : "border-white/10 bg-white/[0.025]" : "border-rose-400/15 bg-rose-400/[0.04]"}`}>
    <div className="flex items-center gap-1.5"><Icon size={12} className={completed ? "text-emerald-300" : eligible ? "text-accent" : "text-rose-300"} /><span className="text-[10px] font-black text-white">{meta.short}</span>{completed ? <CheckCircle2 size={12} className="ml-auto text-emerald-300" /> : eligible ? <span className="ml-auto text-[9px] font-bold text-accent">OK</span> : <XCircle size={12} className="ml-auto text-rose-300" />}</div>
    <p className="mt-1 text-[9px] text-muted">{eligible ? completed ? `${score} pts` : `eligible · up to ${meta.max}` : "not eligible"}</p>
  </div>;
}

export function MapsBrowser({ maps, rankInfo, userRhp, showLegacy: externalShowLegacy, modeScores, modeTab = "all" }: Props) {
  const [showAll, setShowAll] = useState(false); const [showLegacy, setShowLegacy] = useState(externalShowLegacy ?? false); const [query, setQuery] = useState(""); const [visibleCount, setVisibleCount] = useState(PAGE_SIZE); const [busyId, setBusyId] = useState(""); const [messages, setMessages] = useState<Record<string, string>>({});
  useEffect(() => { if (externalShowLegacy !== undefined) setShowLegacy(externalShowLegacy); }, [externalShowLegacy]);
  useEffect(() => setVisibleCount(PAGE_SIZE), [modeTab, showAll, showLegacy]);

  const modePoints = useMemo(() => Object.values(modeScores).reduce((sum, row) => ({ lock: sum.lock + Number(row.lock || 0), spin: sum.spin + Number(row.spin || 0), vr: sum.vr + Number(row.vr || 0) }), { lock: 0, spin: 0, vr: 0 }), [modeScores]);
  const modeRanks = useMemo(() => ({ lock: getRankInfo(modePoints.lock), spin: getRankInfo(modePoints.spin), vr: getRankInfo(modePoints.vr) }), [modePoints]);
  const activeMode: ModeKey | null = modeTab === "lock" || modeTab === "spin" || modeTab === "vr" ? modeTab : null;
  const activeRank = activeMode ? modeRanks[activeMode] : rankInfo;
  const activePoints = activeMode ? modePoints[activeMode] : userRhp;

  const eligibleFor = (map: MapEntry, mode: ModeKey) => Boolean((map.isRanked || map.isLegacy) && map.rating != null && isMapInRankRange(map.rating, modeRanks[mode].index));
  const visibleForTab = (map: MapEntry) => activeMode ? eligibleFor(map, activeMode) : Boolean((map.isRanked || map.isLegacy) && map.rating != null && isMapInRankRange(map.rating, rankInfo.index));
  const filtered = useMemo(() => {
    let list = maps.filter((map) => {
      if (modeTab === "legacy" && !map.isLegacy) return false;
      if (map.isLegacy && modeTab !== "legacy" && !showLegacy) return false;
      if (showAll) return true;
      if (map.isRanked || map.isLegacy) return visibleForTab(map);
      return modeTab === "all";
    });
    const term = query.trim().toLowerCase();
    if (term) list = list.filter((map) => map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term));
    return list;
  }, [maps, showAll, showLegacy, query, modeTab, activeMode, activeRank.index, rankInfo.index]);
  const visibleMaps = filtered.slice(0, visibleCount);
  const eligibleCount = maps.filter((map) => visibleForTab(map)).length;

  async function checkMap(id: string) { setBusyId(id); setMessages((v) => ({ ...v, [id]: "Checking Lock, Spin, and VR passes..." })); try { const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: id }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to check your score."); const found = Array.isArray(data.modes) ? data.modes : []; setMessages((v) => ({ ...v, [id]: found.length ? `Passes found: ${found.map((entry: any) => `${entry.label} +${entry.points} ${entry.short}`).join(" · ")}.` : "No new qualifying pass was found." })); } catch (error) { setMessages((v) => ({ ...v, [id]: error instanceof Error ? error.message : "Unable to check your score." })); } finally { setBusyId(""); } }

  return <div className="space-y-5">
    <section className="rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-white/[0.055] to-black/10 p-5 shadow-glow"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><RankIcon rank={activeRank} size={44} /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{activeMode ? `${MODE_META[activeMode].short} eligible maps` : "Available for your overall rank"}</p><p className="mt-1 text-lg font-bold text-white"><span style={{ color: activeRank.color }}>{labelRank(activeRank)}</span> · {eligibleCount} maps</p><p className="mt-1 text-xs text-muted">Rating {activeRank.rangeMin.toFixed(2)}–{activeRank.rangeMax.toFixed(2)} · {activePoints.toLocaleString()} {activeMode ? MODE_META[activeMode].short : "RHP"}</p></div></div><label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-accent" /><span className="text-xs font-semibold text-white">Show maps outside this rank</span></label></div><div className="relative mt-4"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search map, artist, or mapper" className="w-full rounded-2xl border border-white/10 bg-black/15 py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted focus:border-accent/45 focus:outline-none" /></div></section>
    {activeMode && <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 text-xs leading-5 text-white">This view uses your <b>{MODE_META[activeMode].short}</b> rank, not your overall RHP rank. A red X means that map cannot currently award {MODE_META[activeMode].short}.</div>}
    {filtered.length === 0 ? <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-black/10 p-10 text-center text-sm text-muted">No maps match this eligibility view.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleMaps.map((map) => {
      const mapScores = modeScores[titleKey(map.title)] ?? { lock: 0, spin: 0, vr: 0 }; const displayRank = map.rating != null ? RANKS[map.rankIndex] : null; const displayRankColor = displayRank?.color ?? map.rankColor; const displayRankInfo = getRankInfo(displayRank?.minRhp ?? rankInfo.minRhp); const eligible = activeMode ? eligibleFor(map, activeMode) : visibleForTab(map); const duration = lengthLabel(map.length); const message = messages[map.id];
      return <article key={map.id} className="group flex min-h-[390px] flex-col overflow-hidden rounded-[1.75rem] border bg-gradient-to-br from-white/[0.045] to-black/15 shadow-glow transition hover:-translate-y-1" style={{ borderColor: eligible ? `${displayRankColor}55` : "rgba(244,63,94,.22)" }}>
        {map.imageUrl && <Link href={`/maps/${map.id}`} className="block h-28 overflow-hidden border-b border-white/10 bg-black/20"><img src={map.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-105 group-hover:opacity-100" /></Link>}
        <div className="flex flex-1 flex-col p-4"><Link href={`/maps/${map.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 line-clamp-2 text-lg font-bold text-white group-hover:text-accent">{map.title}</h3><p className="mt-1 truncate text-[11px] text-muted">{map.mapperName ?? map.submittedBy?.displayName ?? map.submittedBy?.username ?? "Unknown mapper"}</p></div>{map.rating != null && <div className="shrink-0 text-right"><RankIcon rank={displayRankInfo} size={36} /><span className="mt-1 inline-block text-[10px] font-black" style={{ color: displayRankColor }}>{map.rating.toFixed(2)}</span></div>}</div>
        <div className="mt-4 grid grid-cols-3 gap-1.5"><ModeChip mode="lock" score={mapScores.lock} eligible={eligibleFor(map, "lock")} active={modeTab === "lock"} /><ModeChip mode="spin" score={mapScores.spin} eligible={eligibleFor(map, "spin")} active={modeTab === "spin"} /><ModeChip mode="vr" score={mapScores.vr} eligible={eligibleFor(map, "vr")} active={modeTab === "vr"} /></div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted">{map.noteCount != null && <span className="rounded-full border border-white/8 bg-black/10 px-2 py-1">{map.noteCount.toLocaleString()} notes</span>}{duration && <span className="rounded-full border border-white/8 bg-black/10 px-2 py-1">{duration}</span>}<span className="rounded-full border border-white/8 bg-black/10 px-2 py-1" style={{ color: displayRankColor }}>{displayRank?.name ?? map.rankName}</span></div></Link>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4"><p className="text-[10px] leading-4 text-muted">{eligible ? activeMode ? `Eligible for ${MODE_META[activeMode].short}.` : "Eligible for your current overall rank." : "Outside the selected eligibility range."}</p>{(map.isRanked || map.isLegacy) && <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="shrink-0 rounded-xl bg-accent px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">{busyId === map.id ? "Checking…" : "Check"}</button>}</div>{message && <p className="mt-3 rounded-xl border border-accent/25 bg-accent/[0.07] p-3 text-[11px] leading-5 text-accent">{message}</p>}</div>
      </article>;
    })}</div>}
    {filtered.length > visibleMaps.length && <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} className="rounded-full border border-accent/30 bg-accent/[0.07] px-6 py-2.5 text-sm font-semibold text-white">Show more ({filtered.length - visibleMaps.length} remaining)</button></div>}
  </div>;
}
