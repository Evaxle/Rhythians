"use client";

import { useState } from "react";
import { Trophy, Swords, Layers } from "lucide-react";
import { DailyLeaderboard, type DailyLeaderboardRow } from "@/components/daily/daily-leaderboard";
import { ChallengeLeaderboard, type ChallengeRow } from "@/components/daily/challenge-leaderboard";
import { ChallengeLevelLeaderboard, type ChallengeLevelRow } from "@/components/daily/challenge-level-leaderboard";
import { RANKS, type RankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";
import { ModeLeaderboard } from "@/components/daily/mode-leaderboard";
import type { ModeKey } from "@/lib/rhythia-mode-points";

type Section = "global" | "my-rank" | ModeKey;
type ModeLeaderboards = Record<ModeKey, any[]>;

function rankInfoFor(index: number): RankInfo {
  const rank = RANKS[index] ?? RANKS[0];
  return { index, name: rank.name, tier: 1, isExpert: index === RANKS.length - 1, minRhp: rank.minRhp, maxRhp: index < RANKS.length - 1 ? rank.minRhp + 500 : null, tierStart: rank.minRhp, tierEnd: rank.minRhp + 100, nextTierStart: rank.minRhp + 100, nextRankStart: index < RANKS.length - 1 ? rank.minRhp + 500 : null, color: rank.color, progressToNextTier: 0, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
}

function SectionTabs({ selected, onSelect, initialRankIndex }: { selected: Section; onSelect: (section: Section) => void; initialRankIndex: number }) {
  const rank = rankInfoFor(initialRankIndex);
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onSelect("global")} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === "global" ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>Global RHP</button><button type="button" onClick={() => onSelect("my-rank")} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === "my-rank" ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}><RankIcon rank={rank} size={24} />My RHP Rank · {rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`}</button>{(["lock", "spin", "vr"] as const).map((section) => <button key={section} type="button" onClick={() => onSelect(section)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === section ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>{section === "lock" ? "🔒 Lock · RPL" : section === "spin" ? "🌀 Spin · RPS" : "🥽 VR · RPV"}</button>)}</div>;
}

export function LeaderboardTabs({ dailyLeaderboards, challengeLeaderboards, modeLeaderboards, challengeLevelLeaderboard, currentUserId, initialRankIndex = 0 }: { dailyLeaderboards: DailyLeaderboardRow[][]; challengeLeaderboards: ChallengeRow[][]; modeLeaderboards: ModeLeaderboards; challengeLevelLeaderboard: ChallengeLevelRow[]; currentUserId: string | null; initialRankIndex?: number }) {
  const [tab, setTab] = useState<"daily" | "ranked" | "challenge">("daily");
  const [rankedSection, setRankedSection] = useState<Section>("global");
  const globalDailyRows = [...dailyLeaderboards.flat()].sort((a, b) => b.streak - a.streak || b.lastBeatAt.getTime() - a.lastBeatAt.getTime()).map((row, index) => ({ ...row, position: index + 1 }));
  const globalRankedRows = [...challengeLeaderboards.flat()].sort((a, b) => b.rhp - a.rhp).map((row, index) => ({ ...row, position: index + 1 }));
  const renderRanked = () => { if (rankedSection === "global") return <ChallengeLeaderboard key="ranked-global" leaderboards={[globalRankedRows]} currentUserId={currentUserId} initialRankIndex={0} hideRankPicker />; if (rankedSection === "my-rank") return <ChallengeLeaderboard key="ranked-my-rank" leaderboards={challengeLeaderboards} currentUserId={currentUserId} initialRankIndex={initialRankIndex} />; return <ModeLeaderboard key={`ranked-${rankedSection}`} mode={rankedSection} rows={modeLeaderboards[rankedSection]} currentUserId={currentUserId} />; };
  return <div className="space-y-6"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setTab("daily")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "daily" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Trophy size={16} /> Daily</button><button type="button" onClick={() => setTab("ranked")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "ranked" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Swords size={16} /> Ranked</button><button type="button" onClick={() => setTab("challenge")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "challenge" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Layers size={16} /> Challenge</button></div>{tab === "daily" ? <DailyLeaderboard leaderboards={[globalDailyRows]} currentUserId={currentUserId} initialRankIndex={0} hideRankPicker /> : tab === "ranked" ? <section className="space-y-6"><SectionTabs selected={rankedSection} onSelect={setRankedSection} initialRankIndex={initialRankIndex} />{renderRanked()}</section> : <ChallengeLevelLeaderboard rows={challengeLevelLeaderboard} currentUserId={currentUserId} />}</div>;
}
