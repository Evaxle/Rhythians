"use client";

import { useState } from "react";
import { Trophy, Swords } from "lucide-react";
import { DailyLeaderboard, type DailyLeaderboardRow } from "@/components/daily/daily-leaderboard";
import { ChallengeLeaderboard, type ChallengeRow } from "@/components/daily/challenge-leaderboard";

export function LeaderboardTabs({
  dailyLeaderboards,
  challengeLeaderboards,
  currentUserId,
}: {
  dailyLeaderboards: DailyLeaderboardRow[][];
  challengeLeaderboards: ChallengeRow[][];
  currentUserId: string | null;
}) {
  const [tab, setTab] = useState<"daily" | "challenges">("daily");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("daily")}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "daily"
              ? "bg-accent text-white"
              : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"
          }`}
        >
          <Trophy size={16} /> Daily leaderboards
        </button>
        <button
          type="button"
          onClick={() => setTab("challenges")}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "challenges"
              ? "bg-accent text-white"
              : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"
          }`}
        >
          <Swords size={16} /> Challenge leaderboards
        </button>
      </div>

      {tab === "daily" ? (
        <DailyLeaderboard leaderboards={dailyLeaderboards} currentUserId={currentUserId} />
      ) : (
        <ChallengeLeaderboard leaderboards={challengeLeaderboards} currentUserId={currentUserId} />
      )}
    </div>
  );
}