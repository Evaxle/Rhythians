"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Glasses, LockKeyhole, RotateCw, Search } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { getRankInfo, isMapInRankRange, RANKS } from "@/lib/ranks";
import { modeRankInfo } from "@/lib/rhythia-mode-rank";
import type { ModeKey, ModePoints } from "@/lib/rhythia-mode-rules";
import { RankIcon } from "@/components/rank-icon";

const PAGE_SIZE = 40;
type ModeScore = { lock: number; spin: number; vr: number };
export type ModeScoreMap = Record<string, ModeScore>;
type MapEntry = { id: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number | null; rankIndex: number; rankName: string; rankColor: string; mapperName: string | null; noteCount: number | null; length: number | null; completion: { passed: boolean; points: number } | null; hasScore: boolean; submittedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; reviewedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; isRanked: boolean; isLegacy: boolean };
type MapTab = "all" | ModeKey;
type Props = { maps: MapEntry[]; rankInfo: RankInfo; userRhp: number; currentUserId: string | null; showLegacy?: boolean; onShowLegacyChange?: (value: boolean) => void; modeScores: ModeScoreMap; modePoints: ModePoints };

const tabs: Array<{ key: MapTab; label: string; description: string }> = [{ key: "all", label: "All", description: "Main RHP" }, { key: "lock", label: "RPL", description: "Lock" }, { key: "spin", label: "RPS", description: "Spin" }, { key: "vr", label: "RPV", description: "VR" }];
const modes: ModeKey[] = ["lock", "spin", "vr"];

function titleKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function modeLabel(mode: ModeKey) { return mode === "lock" ? "RPL" : mode === "spin" ? "RPS" : "RPV"; }
function rankName(info: RankInfo) { return info.isExpert ? "Expert" : info.name; }
function modeIcon(mode: ModeKey) { return mode === "lock" ? LockKeyhole : mode === "spin" ? RotateCw : Glasses; }

export function MapsBrowser({ maps, rankInfo, userRhp, currentUserId, showLegacy: externalShowLegacy, onShowLegacyChange, modeScores, modePoints }: Props) {
  const [activeTab, setActiveTab] = useState<MapTab>("all");
  const [showLegacy, setShowLegacy] = useState(externalShowLegacy ?? false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [checkedScores, setCheckedScores] = useState<Record<string, ModeScore>>({});

  useEffect(() => { if (externalShowLegacy !== undefined) setShowLegacy(externalShowLegacy); }, [externalShowLegacy]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeTab, showLegacy, query]);

  const selectedRankInfo = activeTab === "all" ? rankInfo : modeRankInfo(modePoints[activeTab], activeTab);
  const filtered = useMemo(() => maps.filter((map) => {
    if (map.isLegacy && !showLegacy) return false;
    if (!map.isRanked && !map.isLegacy) return false;
    if (map.rating == null || !isMapInRankRange(map.rating, selectedRankInfo.index)) return false;
    const term = query.trim().toLowerCase();
    return !term || map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term);
  }), [maps, query, selectedRankInfo.index, showLegacy]);

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: "Checking Rhythia scores..." }));
    try {
      const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your score.");
      const checked: ModeScore = { lock: 0, spin: 0, vr: 0 };
      for (const entry of Array.isArray(data.modes) ? data.modes : []) if (modes.includes(entry.mode)) checked[entry.mode as ModeKey] = Math.max(checked[entry.mode as ModeKey], Number(entry.points) || 0);
      setCheckedScores((current) => ({ ...current, [id]: checked }));
      const found = modes.filter((mode) => checked[mode] > 0);
      setMessages((current) => ({ ...current, [id]: found.length ? found.map((mode) => `${checked[mode]} ${modeLabel(mode)}`).join(" · ") : "No qualifying passing score found." }));
    } catch (error) {
      setMessages((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Unable to check your score." }));
    } finally { setBusyId(""); }
  }

  const visibleMaps = filtered.slice(0, visibleCount);
  return <div className="maps-browser space-y-5"><div className="ui-card rounded-3xl p-3"><div className="grid grid-cols-4 gap-2">{tabs.map((tab) => { const active = activeTab === tab.key; const tabRank = tab.key === "all" ? rankInfo : modeRankInfo(modePoints[tab.key], tab.key); return <motion.button whileHover={{ y: -2 }} whileTap={{ scale: .97 }} key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`relative min-w-0 overflow-hidden rounded-2xl border px-2 py-3 text-center ${active ? "border-accent/50 bg-accent/12" : "border-white/10 bg-background/40"}`}>{active && <motion.span layoutId="map-mode-tab" className="absolute inset-0 -z-10 bg-accent/8" />}<span className="block text-sm font-bold text-white">{tab.label}</span><span className="mt-0.5 block truncate text-[10px] text-muted">{tab.description}</span><span className="mt-1 block truncate text-[10px] font-semibold" style={{ color: tabRank.color }}>{rankName(tabRank)}</span></motion.button>; })}</div></div>
    <div className="ui-card flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 text-sm text-muted"><RankIcon rank={selectedRankInfo} size={34} />Your {activeTab === "all" ? "RHP" : modeLabel(activeTab)} rank: <span className="font-semibold" style={{ color: selectedRankInfo.color }}>{rankName(selectedRankInfo)}</span> · {activeTab === "all" ? `${userRhp.toLocaleString()} RHP` : `${modePoints[activeTab].toLocaleString()} ${modeLabel(activeTab)}`}</p><p className="mt-1 text-xs text-muted">Map range <span className="font-semibold text-white">{selectedRankInfo.rangeMin.toFixed(2)} – {selectedRankInfo.rangeMax.toFixed(2)}</span></p></div><label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3"><input type="checkbox" checked={showLegacy} onChange={(event) => { setShowLegacy(event.target.checked); onShowLegacyChange?.(event.target.checked); }} className="h-4 w-4 accent-accent" /><span className="text-sm font-semibold text-white">Legacy maps</span></label></div>
    <div className="relative"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search maps by title, artist, or mapper..." className="w-full rounded-full border border-border bg-surface/95 py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted" /></div>
    {filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-border bg-background/50 p-10 text-center text-sm text-muted">No maps are available for this rank.</div> : <div className="maps-grid grid gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{visibleMaps.map((map, index) => { const scores = checkedScores[map.id] ?? modeScores[titleKey(map.title)] ?? { lock: 0, spin: 0, vr: 0 }; const displayRank = map.isLegacy && map.rating != null ? RANKS[map.rankIndex] : null; const color = displayRank?.color ?? map.rankColor; const displayRankInfo = getRankInfo(displayRank?.minRhp ?? RANKS[map.rankIndex]?.minRhp ?? rankInfo.minRhp); const lengthLabel = map.length != null ? `${Math.floor(map.length / 60000)}:${String(Math.round((map.length % 60000) / 1000)).padStart(2, "0")}` : null; return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .18) }} whileHover={{ y: -4 }} key={map.id} className="flex min-h-[330px] flex-col overflow-hidden rounded-3xl border bg-surface/95 p-4 shadow-glow" style={{ borderColor: `${color}60` }}><Link href={`/maps/${map.id}`} className="min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-white">{map.title}</h3><p className="mt-1 truncate text-[11px] text-muted">{map.mapperName ?? map.submittedBy?.displayName ?? map.submittedBy?.username ?? "Unknown mapper"}</p></div>{map.rating != null && <div className="flex shrink-0 flex-col items-end gap-1"><RankIcon rank={displayRankInfo} size={34} /><span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ color, border: `1px solid ${color}60`, backgroundColor: `${color}12` }}>{map.rating.toFixed(2)}</span></div>}</div><div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">{activeTab === "all" && modes.map((mode) => { const available = map.rating != null && isMapInRankRange(map.rating, modeRankInfo(modePoints[mode], mode).index); const Icon = modeIcon(mode); return <span key={mode} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${available ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-muted"}`}><Icon size={11} /> {modeLabel(mode)}</span>; })}{modes.filter((mode) => scores[mode] > 0).map((mode) => <span key={`score-${mode}`} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 font-semibold text-emerald-300">{scores[mode]} {modeLabel(mode)}</span>)}{map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2 py-1">{map.noteCount.toLocaleString()} notes</span>}{lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2 py-1">{lengthLabel}</span>}</div></Link><div className="mt-auto flex items-center justify-between gap-2 pt-4"><span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>{displayRank?.name ?? map.rankName}</span><button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === map.id ? "Checking..." : "Check scores"}</button></div>{messages[map.id] && <p className="mt-3 rounded-2xl border border-accent/30 bg-accent/10 p-3 text-xs leading-5 text-accent">{messages[map.id]}</p>}</motion.article>; })}</div>}{filtered.length > visibleMaps.length && <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white">Show more</button></div>}</div>;
}
