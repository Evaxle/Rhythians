"use client";

import { useState } from "react";
import { BarChart3, Map as MapIcon, Trophy } from "lucide-react";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/category-constants";
import { CategoryMapsTab } from "@/components/categories/category-maps-tab";
import { CategoryLeaderboardTab } from "@/components/categories/category-leaderboard-tab";
import { CategoryStatsTab } from "@/components/categories/category-stats-tab";
import { ChallengeBrowser } from "@/components/challenge/challenge-browser";

type Level = { category: Category; level: number };
type Stats = { category: Category; label: string; level: number; completions: number; mapsAtNextLevel: number; mapsCompletedAtNextLevel: number };
type MapEntry = { id: string; category: Category; level: number; title: string; artist: string | null; description: string | null; mapFileUrl: string; imageUrl: string | null; mapperName: string | null; noteCount: number | null; length: number | null; completion: { passed: boolean; accuracy: number | null } | null };
type ChallengeMapEntry = { id: string; level: number; title: string; artist: string | null; mapFileUrl: string; mapperName: string | null; noteCount: number | null; length: number | null; rating: number; completion: { passed: boolean; accuracy: number | null } | null };
type MapView = "challenge" | Category;
type PrimaryTab = "maps" | "leaderboards" | "stats";

export function CategoriesBrowser({ levels, stats, maps, currentUserId, challengeMaps, challengeLevel, isAdmin, defaultTab = "maps" }: { levels: Level[]; stats: Stats[]; maps: Record<Category, MapEntry[]>; currentUserId: string | null; challengeMaps: ChallengeMapEntry[]; challengeLevel: number; isAdmin: boolean; defaultTab?: "maps" | "leaderboards" | "stats" | "challenge" }) {
  const initialTab: PrimaryTab = defaultTab === "leaderboards" || defaultTab === "stats" ? defaultTab : "maps";
  const [tab, setTab] = useState<PrimaryTab>(initialTab);
  const [category, setCategory] = useState<Category>("jumps");
  const [mapView, setMapView] = useState<MapView>(defaultTab === "challenge" ? "challenge" : "jumps");
  const levelMap = new Map(levels.map((entry) => [entry.category, entry.level]));

  const openMaps = (view: MapView) => {
    setMapView(view);
    if (view !== "challenge") setCategory(view);
    setTab("maps");
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setTab("maps")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "maps" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><MapIcon size={16} /> Maps</button>
      <button type="button" onClick={() => setTab("leaderboards")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "leaderboards" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Trophy size={16} /> Leaderboards</button>
      <button type="button" onClick={() => setTab("stats")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "stats" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><BarChart3 size={16} /> Stats</button>
    </div>

    {tab === "maps" && <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-3xl border border-border bg-surface/95 p-3 shadow-glow">
        <button type="button" onClick={() => openMaps("challenge")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mapView === "challenge" ? "bg-accent text-white" : "border border-white/10 bg-white/5 text-muted hover:text-white"}`}>Challenge</button>
        {CATEGORIES.map((entry) => <button key={entry} type="button" onClick={() => openMaps(entry)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mapView === entry ? "bg-accent text-white" : "border border-white/10 bg-white/5 text-muted hover:text-white"}`}>{CATEGORY_LABELS[entry]}</button>)}
      </div>
      {mapView === "challenge" ? <ChallengeBrowser maps={challengeMaps} level={challengeLevel} isAdmin={isAdmin} compactHeader /> : <CategoryMapsTab category={mapView} level={levelMap.get(mapView) ?? 0} maps={maps[mapView] ?? []} isAdmin={isAdmin} />}
    </div>}

    {tab === "leaderboards" && <CategoryLeaderboardTab category={category} onCategoryChange={setCategory} currentUserId={currentUserId} />}
    {tab === "stats" && <CategoryStatsTab stats={stats} />}
  </div>;
}
