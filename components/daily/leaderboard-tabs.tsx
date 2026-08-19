"use client";

import { useState } from "react";
import { Trophy, Swords, Layers } from "lucide-react";
import { DailyLeaderboard, type DailyLeaderboardRow } from "@/components/daily/daily-leaderboard";
import { ChallengeLeaderboard, type ChallengeRow } from "@/components/daily/challenge-leaderboard";
import { ChallengeLevelLeaderboard, type ChallengeLevelRow } from "@/components/daily/challenge-level-leaderboard";

export function LeaderboardTabs({
  dailyLeaderboards,
  challengeLeaderboards,
  challengeLevelLeaderboard,
  currentUserId,
  initialRankIndex,
}: {
  dailyLeaderboards: DailyLeaderboardRow[][];
  challengeLeaderboards: ChallengeRow[][];
  challengeLevelLeaderboard: ChallengeLevelRow[];
  currentUserId: string | null;
  initialRankIndex: number;
}) {
  const [tab, setTab] = useState<"daily" | "maps" | "challenge">("daily");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("daily")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "daily" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Trophy size={16} /> Daily</button>
        <button type="button" onClick={() => setTab("maps")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "maps" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Swords size={16} /> Maps</button>
        <button type="button" onClick={() => setTab("challenge")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "challenge" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Layers size={16} /> Challenge</button>
      </div>
      {tab === "daily" ? <DailyLeaderboard leaderboards={dailyLeaderboards} currentUserId={currentUserId} initialRankIndex={initialRankIndex} /> : tab === "maps" ? <ChallengeLeaderboard leaderboards={challengeLeaderboards} currentUserId={currentUserId} /> : <ChallengeLevelLeaderboard rows={challengeLevelLeaderboard} currentUserId={currentUserId} />}
    </div>
  );
}
