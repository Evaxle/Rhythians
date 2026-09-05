"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LockKeyhole, RotateCw, Glasses } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { isMapInRankRange, RANKS, getRankInfo } from "@/lib/ranks";
import { modeRankInfo, type ModeKey, type ModePoints } from "@/lib/rhythia-mode-points";
import { RankIcon } from "@/components/rank-icon";

const PAGE_SIZE = 40;
type ModeScore = { lock: number; spin: number; vr: number };
export type ModeScoreMap = Record<string, ModeScore>;
type MapEntry = { id: string; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; rating: number | null; rankIndex: number; rankName: string; rankColor: string; mapperName: string | null; noteCount: number | null; length: number | null; completion: { passed: boolean; points: number } | null; hasScore: boolean; submittedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; reviewedBy: { displayName: string | null; username: string | null; profileHandle: string | null } | null; isRanked: boolean; isLegacy: boolean };
type MapTab = "all" | ModeKey;
type Props = { maps: MapEntry[]; rankInfo: RankInfo; userRhp: number; currentUserId: string | null; showLegacy?: boolean; onShowLegacyChange?: (value: boolean) => void; modeScores: ModeScoreMap; modePoints: ModePoints };

const tabs: Array<{ key: MapTab; label: string; description: string }> = [
  { key: "all", label: "All", description: "Your main RHP rank" },
  { key: "lock", label: "RPL", description: "Lock rank" },
  { key: "spin", label: "RPS", description: "Spin rank" },
  { key: "vr", label: "RPV", description: "VR rank" },
];

function titleKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function scoreModes(score: ModeScore | undefined) { return ([ "lock", "spin", "vr" ] as const).filter((mode) => Boolean(score?.[mode])); }
function modeLabel(mode: ModeKey) { return mode === "lock" ? "RPL" : mode === "spin" ? "RPS" : "RPV"; }
function modeName(mode: ModeKey) { return mode === "lock" ? "Lock" : mode === "spin" ? "Spin" : "VR"; }

export function MapsBrowser({ maps, rankInfo, userRhp, currentUserId, showLegacy: externalShowLegacy, onShowLegacyChange, modeScores, modePoints }: Props) {
  const [activeTab, setActiveTab] = useState<MapTab>("all");
  const [showLegacy, setShowLegacy] = useState(externalShowLegacy ?? false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [checkedScores, setCheckedScores] = useState<Record<string, ModeScore>>({});

  useEffect(() => { if (externalShowLegacy !== undefined) setShowLegacy(externalShowLegacy); }, [externalShowLegacy]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeTab, showLegacy]);

  const selectedRankInfo = activeTab === "all" ? rankInfo : modeRankInfo(modePoints[activeTab], activeTab);
  const filtered = useMemo(() => {
    let list = maps.filter((map) => {
      if (map.isLegacy && !showLegacy) return false;
      if (map.isRanked || map.isLegacy) return map.rating != null && isMapInRankRange(map.rating, selectedRankInfo.index);
      return false;
    });
    const term = query.trim().toLowerCase();
    if (term) list = list.filter((map) => map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term));
    return list;
  }, [maps, selectedRankInfo.index, showLegacy, query]);

  const visibleMaps = filtered.slice(0, visibleCount);

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: "Checking Rhythia scores..." }));
    try {
      const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your score.");
      const found = Array.isArray(data.modes) ? data.modes : [];
      const checked: ModeScore = { lock: 0, spin: 0, vr: 0 };
      for (const entry of found as Array<{ mode: "lock" | "spin" | "vr"; points: number }>) checked[entry.mode] = Math.max(checked[entry.mode], Number(entry.points) || 0);
      setCheckedScores((current) => ({ ...current, [id]: checked }));
      const message = found.length > 0 ? `Score found · ${checked.lock} RPL · ${checked.spin} RPS · ${checked.vr} RPV · ${Number(data.points) || 0} mode points. RPL, RPS, and RPV are counted separately toward RHP.` : data.status === "already" ? "Your existing mode scores are already synchronized for this map." : "No qualifying passing score was found for this map.";
      setMessages((current) => ({ ...current, [id]: message }));
    } catch (error) {
      setMessages((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Unable to check your score." }));
    } finally { setBusyId(""); }
  }

  return <div className="maps-browser space-y-5">
    <div className="rounded-3xl border border-border bg-surface/95 p-3 shadow-glow">
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          const tabRank = tab.key === "all" ? rankInfo : modeRankInfo(modePoints[tab.key], tab.key);
          return <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`min-w-0 rounded-2xl border px-2 py-3 text-center transition ${active ? "border-accent/50 bg-accent/12 shadow-glow" : "border-white/8 bg-background/40 hover:border-accent/25 hover:bg-white/[0.03]"}`}>
            <span className="block text-sm font-bold text-white">{tab.label}</span>
            <span className="mt-0.5 block truncate text-[10px] text-muted">{tab.description}</span>
            <span className="mt-1 block text-[10px] font-semibold" style={{ color: tabRank.color }}>{tabRank.isExpert ? "Expert" : `${tabRank.name} ${tabRank.tier}`}</span>
          </button>;
        })}
      </div>
    </div>

    <div className="maps-browser-toolbar flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm text-muted"><RankIcon rank={selectedRankInfo} size={34} />Your {activeTab === "all" ? "main RHP" : modeLabel(activeTab)} rank: <span className="font-semibold" style={{ color: selectedRankInfo.color }}>{selectedRankInfo.isExpert ? "Expert" : `${selectedRankInfo.name} ${selectedRankInfo.tier}`}</span> · {activeTab === "all" ? `${userRhp.toLocaleString()} RHP` : `${modePoints[activeTab].toLocaleString()} ${modeLabel(activeTab)}`}</p>
        <p className="mt-1 text-xs text-muted">Maps available for this rank: <span className="font-semibold text-white">{selectedRankInfo.rangeMin.toFixed(2)} – {selectedRankInfo.rangeMax.toFixed(2)}</span></p>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
        <input type="checkbox" checked={showLegacy} onChange={(event) => { setShowLegacy(event.target.checked); onShowLegacyChange?.(event.target.checked); }} className="h-4 w-4 accent-accent" />
        <span className="text-sm font-semibold text-white">Show legacy maps</span>
      </label>
    </div>

    <div className="relative"><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search maps by title, artist, or mapper..." className="w-full rounded-full border border-border bg-surface/95 py-3 px-4 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none" /></div>

    {activeTab === "all" && <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-xs leading-5 text-muted">All shows maps in your main RHP rank range. The availability tags on each map show whether that same map is currently accessible through your RPL, RPS, and RPV ranks.</div>}
    {activeTab !== "all" && <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-xs leading-5 text-muted">RPL, RPS, and RPV use separate rank progress. This tab only shows maps inside your <span className="font-semibold text-white">{modeLabel(activeTab)}</span> rank rating range.</div>}

    {filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-border bg-background/50 p-10 text-center text-sm text-muted">{query.trim() ? `No maps match "${query.trim()}" in this rank.` : "No maps are available for this rank."}</div> : <div className="maps-grid grid gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {visibleMaps.map((map) => {
        const message = messages[map.id];
        const awardable = map.isRanked || map.isLegacy;
        const mapScores = checkedScores[map.id] ?? modeScores[titleKey(map.title)] ?? { lock: 0, spin: 0, vr: 0 };
        const foundModes = scoreModes(mapScores);
        const displayRank = map.isLegacy && map.rating != null ? RANKS[map.rankIndex] : null;
        const displayRankName = displayRank?.name ?? map.rankName;
        const displayRankColor = displayRank?.color ?? map.rankColor;
        const displayRankInfo = getRankInfo(displayRank?.minRhp ?? RANKS[map.rankIndex]?.minRhp ?? rankInfo.minRhp);
        const lengthLabel = map.length != null ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}` : null;
        const reviewerHandle = map.reviewedBy?.profileHandle;
        const reviewerName = map.reviewedBy?.displayName ?? map.reviewedBy?.username;
        const availability = ([ "lock", "spin", "vr" ] as ModeKey[]).map((mode) => ({ mode, available: map.rating != null && isMapInRankRange(map.rating, modeRankInfo(modePoints[mode], mode).index) }));
        return <article key={map.id} className="flex min-h-[340px] flex-col overflow-hidden rounded-3xl border bg-surface/95 p-4 shadow-glow transition duration-300 hover:-translate-y-0.5 hover:border-accent/30" style={{ borderColor: awardable ? (foundModes.length > 0 ? "#34d399" : `${displayRankColor}75`) : "#9ca3af55" }}>
          <Link href={`/maps/${map.id}`} className="min-w-0">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-white hover:text-accent">{map.title}</h3><p className="mt-1 truncate text-[11px] text-muted">{map.mapperName ?? map.submittedBy?.displayName ?? map.submittedBy?.username ?? "Unknown mapper"}</p></div>{map.rating != null && <div className="flex shrink-0 flex-col items-end gap-1"><RankIcon rank={displayRankInfo} size={34} /><span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ color: displayRankColor, border: `1px solid ${displayRankColor}60`, backgroundColor: `${displayRankColor}12` }}>{map.rating.toFixed(2)}</span></div>}</div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
              {activeTab === "all" && availability.map(({ mode, available }) => <span key={mode} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${available ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-muted"}`}>{mode === "lock" ? <LockKeyhole size={11} /> : mode === "spin" ? <RotateCw size={11} /> : <Glasses size={11} />}{available ? "Available" : "Not available"} for {modeLabel(mode)}</span>)}
              {activeTab !== "all" && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 font-semibold text-emerald-300">Available for {modeLabel(activeTab)}</span>}
              {foundModes.map((mode) => <span key={`score-${mode}`} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 font-semibold text-emerald-300">{mode === "lock" ? "🔒 Lock" : mode === "spin" ? "🌀 Spin" : "🥽 VR"} · {mode === "lock" ? mapScores.lock : mode === "spin" ? mapScores.spin : mapScores.vr} {modeLabel(mode)}</span>)}
              {map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2 py-1">{map.noteCount.toLocaleString()} notes</span>}
              {lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2 py-1">{lengthLabel}</span>}
            </div>
            {foundModes.length === 0 && awardable && <p className="mt-3 text-xs text-muted">No mode score recorded · up to 25 RPL / 30 RPS / 23 RPV</p>}
            {map.isLegacy && <p className="mt-3 text-xs" style={{ color: displayRankColor }}>Legacy ranked map · points awarded when passed</p>}
          </Link>
          <div className="mt-auto flex items-center justify-between gap-2 pt-4"><span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: displayRankColor }}>{displayRankName}</span>{awardable && <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">{busyId === map.id ? "Checking..." : "Check scores"}</button>}</div>
          {message && <p className="mt-3 rounded-2xl border border-accent/30 bg-accent/10 p-3 text-xs leading-5 text-accent">{message}</p>}
          {map.reviewedBy && reviewerHandle && reviewerName && <p className="mt-3 text-[10px] text-muted">Approved by <Link href={`/profile/${reviewerHandle}`} className="font-semibold text-white hover:text-accent">{reviewerName}</Link></p>}
        </article>;
      })}
    </div>}
    {filtered.length > visibleMaps.length && <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="rounded-full border border-accent/40 bg-accent/10 px-6 py-2.5 text-sm font-semibold text-white">Show more maps ({filtered.length - visibleMaps.length} remaining)</button></div>}
  </div>;
}
