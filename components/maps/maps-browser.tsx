"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Search } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { getRankInfo, mapTierForRating, RANKS } from "@/lib/ranks";
import type { ModePoints } from "@/lib/rhythia-mode-rules";
import { RankIcon } from "@/components/rank-icon";
import type { MapModeTab, ModeScoreMap } from "@/components/maps/maps-sort-controls-persisted";

const PAGE_SIZE = 40;
type MapEntry = { id: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number | null; rankIndex: number; rankName: string; rankColor: string; mapperName: string | null; noteCount: number | null; length: number | null; completion: { passed: boolean; points: number } | null; hasScore: boolean; submittedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; reviewedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; isRanked: boolean; isLegacy: boolean; maxRewards: ModePoints | null };
type Props = { maps: MapEntry[]; rankInfo: RankInfo; userRhp: number; currentUserId: string | null; showLegacy?: boolean; onShowLegacyChange?: (value: boolean) => void; modeScores: ModeScoreMap; modeTab?: MapModeTab };

function lengthLabel(length: number | null) { if (length == null) return null; const seconds = length > 10_000 ? Math.round(length / 1000) : Math.round(length); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function labelRank(rank: RankInfo) { return rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`; }
function mapRankLabel(rating: number | null, rankIndex: number, fallback: string) {
  if (rating == null) return fallback;
  const rank = RANKS[rankIndex] ?? RANKS[RANKS.length - 1];
  return rank.index === RANKS.length - 1 ? "Expert" : `${rank.name} ${mapTierForRating(rating)}`;
}

export function MapsBrowser({ maps, rankInfo, userRhp, showLegacy: externalShowLegacy, modeTab = "all" }: Props) {
  const router = useRouter();
  const [showLegacy, setShowLegacy] = useState(externalShowLegacy ?? false);
  const [rankFilter, setRankFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  useEffect(() => { if (externalShowLegacy !== undefined) setShowLegacy(externalShowLegacy); }, [externalShowLegacy]);
  useEffect(() => setVisibleCount(PAGE_SIZE), [modeTab, showLegacy, rankFilter]);

  const activeMode = modeTab === "lock" || modeTab === "spin" || modeTab === "vr";
  const filtered = (() => {
    let list = maps.filter((map) => {
      if (modeTab === "legacy") return map.isLegacy;
      if (map.isLegacy && !showLegacy) return false;
      if (map.isLegacy && activeMode) return false;
      return true;
    });
    if (rankFilter !== "all") {
      const index = Number(rankFilter);
      list = list.filter((map) => map.rating != null && map.rankIndex === index);
    }
    const term = query.trim().toLowerCase();
    if (term) list = list.filter((map) => map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term));
    return list;
  })();
  const visibleMaps = filtered.slice(0, visibleCount);

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((v) => ({ ...v, [id]: "Checking Lock, Spin, and VR passes..." }));
    try {
      const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ mapId: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your score.");
      const found = Array.isArray(data.modes) ? data.modes : [];
      setMessages((v) => ({ ...v, [id]: found.length ? `Passes found: ${found.map((entry: { label: string; points: number; short: string }) => `${entry.label} +${entry.points} ${entry.short}`).join(" · ")}.` : "No pass for this ranked map was found in your Rhythia scores." }));
      router.refresh();
    } catch (error) {
      setMessages((v) => ({ ...v, [id]: error instanceof Error ? error.message : "Unable to check your score." }));
    } finally { setBusyId(""); }
  }

  const selectedRank = rankFilter === "all" ? "All ranks" : RANKS[Number(rankFilter)]?.name ?? "All ranks";
  return <div className="space-y-5 rounded-[2rem] p-1 sm:p-2" style={{ background: `radial-gradient(circle at top, ${rankInfo.color}24 0%, ${rankInfo.color}0d 28%, transparent 62%)` }}>
    <section className="rounded-[1.8rem] border p-5 shadow-glow" style={{ borderColor: `${rankInfo.color}45`, background: `linear-gradient(135deg, ${rankInfo.color}18, rgba(0,0,0,.16))` }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3"><RankIcon rank={rankInfo} size={44} /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{modeTab === "legacy" ? "Legacy archive" : `${selectedRank} map catalog`}</p><p className="mt-1 text-lg font-bold text-white"><span style={{ color: rankInfo.color }}>{labelRank(rankInfo)}</span> · {filtered.length} maps</p><p className="mt-1 text-xs text-muted">Your {userRhp.toLocaleString()} RHP · choose a map rank or keep every rank visible</p></div></div>
        <label className="grid min-w-[190px] gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Map rank<select value={rankFilter} onChange={(event) => setRankFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white"><option value="all">All ranks</option>{RANKS.map((rank) => <option key={rank.index} value={rank.index}>{rank.name}</option>)}</select></label>
      </div>
      <div className="relative mt-4"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search map, artist, or mapper" className="w-full rounded-2xl border border-white/10 bg-black/15 py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted focus:border-accent/45 focus:outline-none" /></div>
    </section>
    {modeTab === "legacy" && <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-muted">Legacy maps keep their analyzed rating and difficulty timeline as an archive/reference. They do not award RPL, RPV, RPS, or RHP.</div>}
    {filtered.length === 0 ? <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-black/10 p-10 text-center text-sm text-muted">No maps match this filter view.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleMaps.map((map) => {
      const displayRank = map.rating != null ? RANKS[map.rankIndex] : null;
      const displayRankColor = displayRank?.color ?? map.rankColor;
      const displayRankInfo = getRankInfo(displayRank?.minRhp ?? rankInfo.minRhp);
      const duration = lengthLabel(map.length);
      const message = messages[map.id];
      const mapDifficulty = mapRankLabel(map.rating, map.rankIndex, map.rankName);
      return <article key={map.id} className="group flex min-h-[390px] flex-col overflow-hidden rounded-[1.75rem] border bg-gradient-to-br from-white/[0.045] to-black/15 shadow-glow transition hover:-translate-y-1" style={{ borderColor: `${displayRankColor}55` }}>
        {map.imageUrl && <Link href={`/maps/${map.id}`} className="block h-28 overflow-hidden border-b border-white/10 bg-black/20"><img src={map.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-105 group-hover:opacity-100" /></Link>}
        <div className="flex flex-1 flex-col p-4"><Link href={`/maps/${map.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 line-clamp-2 text-lg font-bold text-white group-hover:text-accent">{map.title}</h3><p className="mt-1 truncate text-[11px] text-muted">{map.mapperName ?? map.submittedBy?.displayName ?? map.submittedBy?.username ?? "Unknown mapper"}</p></div>{map.rating != null && <div className="shrink-0 text-right"><RankIcon rank={displayRankInfo} size={36} /><span className="mt-1 inline-block text-[10px] font-black" style={{ color: displayRankColor }}>{map.rating.toFixed(2)}</span></div>}</div>
        {map.isRanked && map.maxRewards && <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/[0.08] p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">Maximum points for a balanced pass</p><div className="mt-3 grid grid-cols-3 gap-2">{([["LOCK", map.maxRewards.lock, "RPL"], ["SPIN", map.maxRewards.spin, "RPS"], ["VR", map.maxRewards.vr, "RPV"]] as const).map(([name, value, short]) => <div key={name} className="rounded-xl border border-white/10 bg-black/15 p-2.5 text-center"><p className="text-[10px] font-bold text-muted">{name}</p><p className="mt-1 text-xl font-black text-white">{value}</p><p className="text-[10px] font-bold text-accent">{short}</p></div>)}</div></div>}
        <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] text-muted">{map.noteCount != null && <span className="rounded-full border border-white/8 bg-black/10 px-2 py-1">{map.noteCount.toLocaleString()} notes</span>}{duration && <span className="rounded-full border border-white/8 bg-black/10 px-2 py-1">{duration}</span>}<span className="rounded-full border border-white/8 bg-black/10 px-2 py-1" style={{ color: displayRankColor }}>{map.isLegacy ? `${mapDifficulty} · Legacy` : mapDifficulty}</span></div></Link>
        <div className="mt-auto pt-4"><div className="flex flex-wrap justify-end gap-2"><Link href={`/maps/${map.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/[0.07] px-3 py-2 text-[11px] font-bold text-white"><Activity size={12} /> View analysis</Link>{map.isRanked && <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="shrink-0 rounded-xl bg-accent px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">{busyId === map.id ? "Checking…" : "Check"}</button>}</div></div>{message && <p className="mt-3 rounded-xl border border-accent/25 bg-accent/[0.07] p-3 text-[11px] leading-5 text-accent">{message}</p>}</div>
      </article>;
    })}</div>}
    {filtered.length > visibleMaps.length && <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} className="rounded-full border border-accent/30 bg-accent/[0.07] px-6 py-2.5 text-sm font-semibold text-white">Show more ({filtered.length - visibleMaps.length} remaining)</button></div>}
  </div>;
}
