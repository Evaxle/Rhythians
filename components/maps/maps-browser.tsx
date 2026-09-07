"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Glasses, LockKeyhole, Search, Sparkles } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { isMapInRankRange, RANKS, getRankInfo } from "@/lib/ranks";
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
function lengthLabel(length: number | null) {
  if (length == null) return null;
  const seconds = length > 10_000 ? Math.round(length / 1000) : Math.round(length);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function ModeChip({ mode, score, eligible, active }: { mode: ModeKey; score: number; eligible: boolean; active: boolean }) {
  const meta = MODE_META[mode];
  const Icon = meta.icon;
  const completed = score > 0;
  return <div className={`rounded-xl border px-2.5 py-2 transition ${!eligible ? "border-white/5 bg-black/10 opacity-35" : completed ? "border-emerald-400/25 bg-emerald-400/[0.08]" : active ? "border-accent/35 bg-accent/[0.08]" : "border-white/10 bg-white/[0.025]"}`}>
    <div className="flex items-center gap-1.5"><Icon size={12} className={completed ? "text-emerald-300" : eligible ? "text-accent" : "text-muted"} /><span className={`text-[10px] font-black ${completed ? "text-emerald-200" : "text-white"}`}>{meta.short}</span>{completed ? <CheckCircle2 size={11} className="ml-auto text-emerald-300" /> : <Circle size={10} className="ml-auto text-muted" />}</div>
    <p className="mt-1 text-[9px] text-muted">{eligible ? completed ? `${score} pts` : `up to ${meta.max}` : "no points"}</p>
  </div>;
}

export function MapsBrowser({ maps, rankInfo, userRhp, showLegacy: externalShowLegacy, modeScores, modeTab = "all" }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [showLegacy, setShowLegacy] = useState(externalShowLegacy ?? false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => { if (externalShowLegacy !== undefined) setShowLegacy(externalShowLegacy); }, [externalShowLegacy]);
  useEffect(() => setVisibleCount(PAGE_SIZE), [modeTab, showAll, showLegacy]);

  const filtered = useMemo(() => {
    let list = maps.filter((map) => {
      if (modeTab === "legacy" && !map.isLegacy) return false;
      if (map.isLegacy && modeTab !== "legacy" && !showLegacy) return false;
      if (showAll) return true;
      if (map.isRanked || map.isLegacy) return map.rating != null && isMapInRankRange(map.rating, rankInfo.index);
      return modeTab === "all";
    });
    const term = query.trim().toLowerCase();
    if (term) list = list.filter((map) => map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term));
    return list;
  }, [maps, showAll, showLegacy, rankInfo.index, query, modeTab]);

  const visibleMaps = filtered.slice(0, visibleCount);
  const eligibleCount = maps.filter((map) => (map.isRanked || map.isLegacy) && map.rating != null && isMapInRankRange(map.rating, rankInfo.index)).length;
  const activeMode = modeTab === "lock" || modeTab === "spin" || modeTab === "vr" ? modeTab : null;

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: "Checking Lock, Spin, and VR passes..." }));
    try {
      const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your score.");
      const found = Array.isArray(data.modes) ? data.modes : [];
      const message = found.length > 0
        ? `Passes found: ${found.map((entry: { label: string; short: string; points: number }) => `${entry.label} +${entry.points} ${entry.short}`).join(" · ")}. RHP is the sum of RPL + RPS + RPV.`
        : "No new qualifying Lock, Spin, or VR pass was found for this map.";
      setMessages((current) => ({ ...current, [id]: message }));
    } catch (error) {
      setMessages((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Unable to check your score." }));
    } finally {
      setBusyId("");
    }
  }

  return <div className="space-y-5">
    <section className="rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-white/[0.055] to-black/10 p-5 shadow-glow">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3"><RankIcon rank={rankInfo} size={44} /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Available for your rank</p><p className="mt-1 text-lg font-bold text-white"><span style={{ color: rankInfo.color }}>{rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`}</span> · {eligibleCount} ranked/legacy maps</p><p className="mt-1 text-xs text-muted">Rating {rankInfo.rangeMin.toFixed(2)}–{rankInfo.rangeMax.toFixed(2)} · {userRhp.toLocaleString()} RHP</p></div></div>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} className="h-4 w-4 accent-accent" /><span className="text-xs font-semibold text-white">Browse outside my rank</span></label>
      </div>
      <div className="relative mt-4"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search title, artist, or mapper" className="w-full rounded-2xl border border-white/10 bg-black/15 py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted focus:border-accent/45 focus:outline-none" /></div>
    </section>

    {showAll && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4 text-xs leading-5 text-amber-100">Maps outside your current rank are visible for browsing, but they do not award RPL, RPS, or RPV until their rating is inside your rank range.</div>}

    {filtered.length === 0 ? <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-black/10 p-10 text-center text-sm text-muted">{query.trim() ? `No maps match “${query.trim()}”.` : "No maps are available in this view."}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleMaps.map((map) => {
      const message = messages[map.id];
      const awardable = map.isRanked || map.isLegacy;
      const inRank = awardable && map.rating != null && isMapInRankRange(map.rating, rankInfo.index);
      const eligible = awardable && inRank;
      const mapScores = modeScores[titleKey(map.title)] ?? { lock: 0, spin: 0, vr: 0 };
      const displayRank = map.rating != null ? RANKS[map.rankIndex] : null;
      const displayRankName = displayRank?.name ?? map.rankName;
      const displayRankColor = displayRank?.color ?? map.rankColor;
      const displayRankInfo = getRankInfo(displayRank?.minRhp ?? RANKS[map.rankIndex]?.minRhp ?? rankInfo.minRhp);
      const duration = lengthLabel(map.length);
      const reviewerHandle = map.reviewedBy?.profileHandle;
      const reviewerName = map.reviewedBy?.displayName ?? map.reviewedBy?.username;
      const selectedScore = activeMode ? Number(mapScores[activeMode] ?? 0) : null;
      return <article key={map.id} className="group flex min-h-[360px] flex-col overflow-hidden rounded-[1.75rem] border bg-gradient-to-br from-white/[0.045] to-black/15 p-4 shadow-glow transition duration-300 hover:-translate-y-1" style={{ borderColor: eligible ? `${displayRankColor}55` : "rgba(255,255,255,.08)", boxShadow: eligible ? `0 16px 50px ${displayRankColor}0b` : undefined }}>
        <Link href={`/maps/${map.id}`} className="min-w-0">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-1.5"><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${map.isLegacy ? "border-violet-400/25 bg-violet-400/10 text-violet-200" : map.isRanked ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200" : "border-white/10 bg-white/[0.03] text-muted"}`}>{map.isLegacy ? "Legacy ranked" : map.isRanked ? "Ranked" : "Unranked"}</span>{eligible && <span className="rounded-full border border-accent/20 bg-accent/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-accent">Counts now</span>}</div><p className="mt-3 truncate text-[11px] text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 line-clamp-2 text-lg font-bold leading-6 text-white transition group-hover:text-accent">{map.title}</h3><p className="mt-1 truncate text-[11px] text-muted">{map.mapperName ?? map.submittedBy?.displayName ?? map.submittedBy?.username ?? "Unknown mapper"}</p></div>{map.rating != null && <div className="flex shrink-0 flex-col items-end gap-1"><RankIcon rank={displayRankInfo} size={38} /><span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: displayRankColor, border: `1px solid ${displayRankColor}55`, backgroundColor: `${displayRankColor}10` }}>{map.rating.toFixed(2)}</span></div>}</div>
          <div className="mt-4 grid grid-cols-3 gap-1.5"><ModeChip mode="lock" score={mapScores.lock} eligible={eligible} active={modeTab === "lock"} /><ModeChip mode="spin" score={mapScores.spin} eligible={eligible} active={modeTab === "spin"} /><ModeChip mode="vr" score={mapScores.vr} eligible={eligible} active={modeTab === "vr"} /></div>
          {activeMode && <p className="mt-3 rounded-xl border border-white/7 bg-black/10 px-3 py-2 text-[11px] text-muted">{selectedScore ? `${MODE_META[activeMode].label} pass recorded: ${selectedScore} ${MODE_META[activeMode].short}.` : eligible ? `Pass this map in ${MODE_META[activeMode].label} to earn ${MODE_META[activeMode].short}.` : `This map is outside your current ${MODE_META[activeMode].short} rank eligibility.`}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted">{map.noteCount != null && <span className="rounded-full border border-white/8 bg-black/10 px-2 py-1">{map.noteCount.toLocaleString()} notes</span>}{duration && <span className="rounded-full border border-white/8 bg-black/10 px-2 py-1">{duration}</span>}<span className="rounded-full border border-white/8 bg-black/10 px-2 py-1" style={{ color: displayRankColor }}>{displayRankName}</span></div>
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4"><p className="text-[10px] leading-4 text-muted">{eligible ? "Lock, Spin, and VR can each contribute once through their own score pool." : awardable ? "Browse only until this map enters your rank range." : "Community map · no ranked points."}</p>{awardable && <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="shrink-0 rounded-xl bg-accent px-3 py-2 text-[11px] font-bold text-white transition hover:bg-accent2 disabled:opacity-50">{busyId === map.id ? "Checking…" : "Check"}</button>}</div>
        {message && <p className="mt-3 rounded-xl border border-accent/25 bg-accent/[0.07] p-3 text-[11px] leading-5 text-accent">{message}</p>}
        {map.reviewedBy && reviewerHandle && reviewerName && <p className="mt-3 text-[9px] text-muted">Approved by <Link href={`/profile/${encodeURIComponent(reviewerHandle)}`} className="font-semibold text-white hover:text-accent">{reviewerName}</Link></p>}
      </article>;
    })}</div>}

    {filtered.length > visibleMaps.length && <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="rounded-full border border-accent/30 bg-accent/[0.07] px-6 py-2.5 text-sm font-semibold text-white">Show more ({filtered.length - visibleMaps.length} remaining)</button></div>}
  </div>;
}
