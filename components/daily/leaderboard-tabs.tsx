"use client";

import { useState } from "react";
import { Trophy, Swords, Layers } from "lucide-react";
import { DailyLeaderboard, type DailyLeaderboardRow } from "@/components/daily/daily-leaderboard";
import { ChallengeLeaderboard, type ChallengeRow } from "@/components/daily/challenge-leaderboard";
import { ChallengeLevelLeaderboard, type ChallengeLevelRow } from "@/components/daily/challenge-level-leaderboard";
import { RANKS } from "@/lib/ranks";

export function LeaderboardTabs({
  dailyLeaderboards,
  challengeLeaderboards,
  challengeLevelLeaderboard,
  currentUserId,
  initialRankIndex = 0,
}: {
  dailyLeaderboards: DailyLeaderboardRow[][];
  challengeLeaderboards: ChallengeRow[][];
  challengeLevelLeaderboard: ChallengeLevelRow[];
  currentUserId: string | null;
  initialRankIndex?: number;
}) {
  const [tab, setTab] = useState<"daily" | "ranked" | "challenge">("daily");
  const [rankedSection, setRankedSection] = useState<"global" | "my-rank" | "lock" | "spin" | "vr">("global");

  const globalRankedRows = [...challengeLeaderboards.flat()]
    .sort((a, b) => b.rhp - a.rhp)
    .map((row, index) => ({ ...row, position: index + 1 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("daily")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "daily" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Trophy size={16} /> Daily</button>
        <button type="button" onClick={() => setTab("ranked")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "ranked" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Swords size={16} /> Ranked</button>
        <button type="button" onClick={() => setTab("challenge")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "challenge" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Layers size={16} /> Challenge</button>
      </div>
      {tab === "daily" ? (
        <DailyLeaderboard leaderboards={dailyLeaderboards} currentUserId={currentUserId} initialRankIndex={initialRankIndex} />
      ) : tab === "ranked" ? (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(["global", "my-rank", "lock", "spin", "vr"] as const).map((section) => (
              <button key={section} type="button" onClick={() => setRankedSection(section)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${rankedSection === section ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>
                {section === "global" ? "Global" : section === "my-rank" ? `Global · ${RANKS[initialRankIndex]?.name ?? "My Rank"}` : section.toUpperCase()}
              </button>
            ))}
          </div>
          {rankedSection === "global" ? (
            <ChallengeLeaderboard leaderboards={[globalRankedRows]} currentUserId={currentUserId} initialRankIndex={0} hideRankPicker />
          ) : rankedSection === "my-rank" ? (
            <ChallengeLeaderboard leaderboards={challengeLeaderboards} currentUserId={currentUserId} initialRankIndex={initialRankIndex} />
          ) : (
            <section className="rounded-2xl border border-border bg-background/60 p-8">
              <p className="text-sm uppercase tracking-[0.24em] text-accent">{rankedSection.toUpperCase()} leaderboard</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">All ranks · {rankedSection.toUpperCase()}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Camera mode is not currently recorded on ranked map completions, so there is no reliable historical {rankedSection.toUpperCase()} leaderboard to display yet.</p>
            </section>
          )}
        </section>
      ) : (
        <ChallengeLevelLeaderboard rows={challengeLevelLeaderboard} currentUserId={currentUserId} />
      )}
    </div>
  );
}
