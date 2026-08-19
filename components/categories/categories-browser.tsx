"use client";

import { useState } from "react";
import { Map as MapIcon, Trophy, BarChart3, Swords } from "lucide-react";
import { type Category } from "@/lib/category-constants";
import { CategoryMapsTab } from "@/components/categories/category-maps-tab";
import { CategoryLeaderboardTab } from "@/components/categories/category-leaderboard-tab";
import { CategoryStatsTab } from "@/components/categories/category-stats-tab";
import { ChallengeBrowser } from "@/components/challenge/challenge-browser";

type Level = { category: Category; level: number };
type Stats = {
  category: Category;
  label: string;
  level: number;
  completions: number;
  mapsAtNextLevel: number;
  mapsCompletedAtNextLevel: number;
};
type MapEntry = {
  id: string;
  category: Category;
  level: number;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  completion: { passed: boolean; accuracy: number | null } | null;
};
type ChallengeMapEntry = {
  id: string;
  level: number;
  title: string;
  artist: string | null;
  mapFileUrl: string;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  rating: number;
  completion: { passed: boolean; accuracy: number | null } | null;
};

export function CategoriesBrowser({
  levels,
  stats,
  maps,
  currentUserId,
  challengeMaps,
  challengeLevel,
  defaultTab = "maps",
}: {
  levels: Level[];
  stats: Stats[];
  maps: Record<Category, MapEntry[]>;
  currentUserId: string | null;
  challengeMaps: ChallengeMapEntry[];
  challengeLevel: number;
  defaultTab?: "maps" | "leaderboards" | "stats" | "challenge";
}) {
  const [tab, setTab] = useState<"maps" | "leaderboards" | "stats" | "challenge">(defaultTab);
  const [category, setCategory] = useState<Category>("jumps");

  const levelMap = new Map(levels.map((entry) => [entry.category, entry.level]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("maps")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "maps" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}>
          <MapIcon size={16} /> Maps
        </button>
        <button type="button" onClick={() => setTab("leaderboards")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "leaderboards" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}>
          <Trophy size={16} /> Leaderboards
        </button>
        <button type="button" onClick={() => setTab("stats")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "stats" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}>
          <BarChart3 size={16} /> Stats
        </button>
        <button type="button" onClick={() => setTab("challenge")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "challenge" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}>
          <Swords size={16} /> Challenge
        </button>
      </div>

      {tab === "maps" && <CategoryMapsTab category={category} onCategoryChange={setCategory} level={levelMap.get(category) ?? 0} maps={maps[category] ?? []} />}
      {tab === "leaderboards" && <CategoryLeaderboardTab category={category} onCategoryChange={setCategory} currentUserId={currentUserId} />}
      {tab === "stats" && <CategoryStatsTab stats={stats} />}
      {tab === "challenge" && <ChallengeBrowser maps={challengeMaps} level={challengeLevel} />}
    </div>
  );
}
