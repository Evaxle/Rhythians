"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Box, Glasses, Layers3, LockKeyhole, SlidersHorizontal, Sparkles } from "lucide-react";
import { MapsBrowser } from "@/components/maps/maps-browser";

export type MapModeTab = "all" | "lock" | "spin" | "vr" | "legacy";
type SortKey = "rating" | "name" | "mapper" | "artist" | "length" | "notes" | "rhp";
type Direction = "asc" | "desc";
type ScoreFilter = "all" | "scored" | "unscored";
type SavedMapFilters = { sortKey: SortKey; direction: Direction; scoreFilter: ScoreFilter; showUnranked: boolean; showLegacy: boolean; modeTab: MapModeTab };
export type ModeScoreMap = Record<string, { lock: number; spin: number; vr: number }>;

const FILTER_STORAGE_KEY = "rhythians:maps:filters:v2";
const tabs: Array<{ key: MapModeTab; label: string; detail: string; icon: typeof Layers3 }> = [
  { key: "all", label: "All eligible", detail: "Your rank", icon: Layers3 },
  { key: "lock", label: "RPL", detail: "Lock", icon: LockKeyhole },
  { key: "spin", label: "RPS", detail: "Spin", icon: Sparkles },
  { key: "vr", label: "RPV", detail: "VR", icon: Glasses },
  { key: "legacy", label: "Legacy", detail: "Ranked archive", icon: Box },
];

function textValue(value: string | null | undefined) { return (value ?? "").trim().toLowerCase(); }
function isModeTab(value: unknown): value is MapModeTab { return value === "all" || value === "lock" || value === "spin" || value === "vr" || value === "legacy"; }
function isSavedMapFilters(value: unknown): value is SavedMapFilters {
  if (!value || typeof value !== "object") return false;
  const filters = value as Partial<SavedMapFilters>;
  return (filters.sortKey === "rating" || filters.sortKey === "name" || filters.sortKey === "mapper" || filters.sortKey === "artist" || filters.sortKey === "length" || filters.sortKey === "notes" || filters.sortKey === "rhp")
    && (filters.direction === "asc" || filters.direction === "desc")
    && (filters.scoreFilter === "all" || filters.scoreFilter === "scored" || filters.scoreFilter === "unscored")
    && typeof filters.showUnranked === "boolean"
    && typeof filters.showLegacy === "boolean"
    && isModeTab(filters.modeTab);
}

export function MapsSortControlsPersisted({ maps, rankInfo, userRhp, currentUserId, modeScores }: ComponentProps<typeof MapsBrowser> & { modeScores: ModeScoreMap }) {
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [direction, setDirection] = useState<Direction>("asc");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [showUnranked, setShowUnranked] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [modeTab, setModeTab] = useState<MapModeTab>("all");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!isSavedMapFilters(saved)) return;
      setSortKey(saved.sortKey);
      setDirection(saved.direction);
      setScoreFilter(saved.scoreFilter);
      setShowUnranked(saved.showUnranked);
      setShowLegacy(saved.showLegacy);
      setModeTab(saved.modeTab);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const filters: SavedMapFilters = { sortKey, direction, scoreFilter, showUnranked, showLegacy, modeTab };
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {}
  }, [sortKey, direction, scoreFilter, showUnranked, showLegacy, modeTab]);

  const filteredMaps = useMemo(() => maps.filter((map) => {
    if (!map.isLegacy && !map.isRanked && !showUnranked) return false;
    if (modeTab === "legacy" && !map.isLegacy) return false;
    const scoreKey = map.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const score = modeScores[scoreKey];
    const selectedModeScore = modeTab === "lock" || modeTab === "spin" || modeTab === "vr" ? Number(score?.[modeTab] ?? 0) : null;
    const hasAnyScore = Boolean(map.hasScore || map.completion?.passed || Number(score?.lock ?? 0) > 0 || Number(score?.spin ?? 0) > 0 || Number(score?.vr ?? 0) > 0);
    const hasSelectedScore = selectedModeScore == null ? hasAnyScore : selectedModeScore > 0;
    if (scoreFilter === "scored" && !hasSelectedScore) return false;
    if (scoreFilter === "unscored" && hasSelectedScore) return false;
    return true;
  }).sort((a, b) => {
    let result = 0;
    if (sortKey === "rating" || sortKey === "rhp") result = (a.rating ?? -Infinity) - (b.rating ?? -Infinity);
    if (sortKey === "name") result = textValue(a.title).localeCompare(textValue(b.title));
    if (sortKey === "mapper") result = textValue(a.mapperName ?? a.submittedBy?.displayName ?? a.submittedBy?.username).localeCompare(textValue(b.mapperName ?? b.submittedBy?.displayName ?? b.submittedBy?.username));
    if (sortKey === "artist") result = textValue(a.artist).localeCompare(textValue(b.artist));
    if (sortKey === "length") result = (a.length ?? -Infinity) - (b.length ?? -Infinity);
    if (sortKey === "notes") result = (a.noteCount ?? -Infinity) - (b.noteCount ?? -Infinity);
    return direction === "asc" ? result : -result;
  }), [maps, modeScores, modeTab, sortKey, direction, scoreFilter, showUnranked]);

  return <div className="space-y-4">
    <nav className="grid grid-cols-2 gap-2 rounded-[1.75rem] border border-white/10 bg-black/15 p-2 sm:grid-cols-5" aria-label="Map point systems">
      {tabs.map(({ key, label, detail, icon: Icon }) => {
        const active = modeTab === key;
        return <button key={key} type="button" onClick={() => { setModeTab(key); if (key === "legacy") setShowLegacy(true); }} className={`group rounded-2xl border px-3 py-3 text-left transition ${active ? "border-accent/45 bg-accent/12 shadow-[0_8px_30px_rgba(124,143,240,.12)]" : "border-transparent bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.05]"}`}>
          <div className="flex items-center gap-2"><Icon size={15} className={active ? "text-accent" : "text-muted group-hover:text-white"} /><span className="text-sm font-bold text-white">{label}</span></div>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">{detail}</span>
        </button>;
      })}
    </nav>

    <div className="rounded-[1.75rem] border border-white/10 bg-surface/80 p-4 shadow-glow backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><SlidersHorizontal size={16} className="text-accent" /> Refine maps</div>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2"><input type="checkbox" checked={showUnranked} onChange={(event) => setShowUnranked(event.target.checked)} className="h-4 w-4 accent-accent" /><span className="text-xs font-semibold text-white">Unranked</span></label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2"><input type="checkbox" checked={showLegacy} onChange={(event) => setShowLegacy(event.target.checked)} className="h-4 w-4 accent-accent" /><span className="text-xs font-semibold text-white">Legacy</span></label>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Sort<select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white"><option value="rating">Rating</option><option value="name">Map name</option><option value="mapper">Mapper</option><option value="artist">Artist</option><option value="length">Length</option><option value="notes">Notes</option><option value="rhp">Point difficulty</option></select></label>
        <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Order<select value={direction} onChange={(event) => setDirection(event.target.value as Direction)} className="rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
        <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Mode progress<select value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value as ScoreFilter)} className="rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white"><option value="all">All</option><option value="scored">Scored</option><option value="unscored">Not scored</option></select></label>
      </div>
    </div>

    <MapsBrowser maps={filteredMaps} rankInfo={rankInfo} userRhp={userRhp} currentUserId={currentUserId} showLegacy={showLegacy} onShowLegacyChange={setShowLegacy} modeScores={modeScores} modeTab={modeTab} />
  </div>;
}
