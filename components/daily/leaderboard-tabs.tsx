"use client";

import { useState } from "react";
import { Trophy, Swords } from "lucide-react";
import type { DailyLeaderboardRow } from "@/lib/daily";
import { DailyLeaderboardTable } from "@/components/daily/daily-leaderboard";
import { ChallengeLeaderboard, type ChallengeRow } from "@/components/daily/challenge-leaderboard";

export function LeaderboardTabs({
  dailyRows,
  monthLabel,
  challengeLeaderboards,
  currentUserId,
}: {
  dailyRows: DailyLeaderboardRow[];
  monthLabel: string;
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
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent">Daily leaderboards</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">{monthLabel}</h2>
            </div>
            <p className="text-sm text-muted">Ranked by the most daily maps beaten this month.</p>
          </div>
          <DailyLeaderboardTable rows={dailyRows} />
        </section>
      ) : (
        <ChallengeLeaderboard leaderboards={challengeLeaderboards} currentUserId={currentUserId} />
      )}
    </div>
  );
}