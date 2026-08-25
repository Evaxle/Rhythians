"use client";

import { useState } from "react";
import { Trophy, Swords, Layers } from "lucide-react";
import { DailyLeaderboard, type DailyLeaderboardRow } from "@/components/daily/daily-leaderboard";
import { ChallengeLeaderboard, type ChallengeRow } from "@/components/daily/challenge-leaderboard";
import { ChallengeLevelLeaderboard, type ChallengeLevelRow } from "@/components/daily/challenge-level-leaderboard";
import { RANKS, type RankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";

type CameraMode = "lock" | "spin" | "vr";
type Section = "global" | "my-rank" | CameraMode;
type CameraLeaderboards<T> = Record<CameraMode, T[][]>;

function rankInfoFor(index: number): RankInfo {
  const rank = RANKS[index] ?? RANKS[0];
  return { index, name: rank.name, tier: 1, isExpert: index === RANKS.length - 1, minRhp: rank.minRhp, maxRhp: index < RANKS.length - 1 ? rank.minRhp + 500 : null, tierStart: rank.minRhp, tierEnd: rank.minRhp + 100, nextTierStart: rank.minRhp + 100, nextRankStart: index < RANKS.length - 1 ? rank.minRhp + 500 : null, color: rank.color, progressToNextTier: 0, rangeMin: rank.rangeMin, rangeMax: rank.rangeMax };
}

function SectionTabs({ selected, onSelect, initialRankIndex }: { selected: Section; onSelect: (section: Section) => void; initialRankIndex: number }) {
  const rank = rankInfoFor(initialRankIndex);
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onSelect("global")} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === "global" ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>Global</button><button type="button" onClick={() => onSelect("my-rank")} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === "my-rank" ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}><RankIcon rank={rank} size={24} />My Rank · {rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`}</button>{(["lock", "spin", "vr"] as const).map((section) => <button key={section} type="button" onClick={() => onSelect(section)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === section ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>{section === "lock" ? "Camera Lock" : section === "spin" ? "Camera Spin" : "VR"}</button>)}</div>;
}

function RankPicker({ selected, onSelect }: { selected: number; onSelect: (rank: number) => void }) {
  return <div className="flex flex-wrap gap-2">{RANKS.map((rank, index) => { const info = rankInfoFor(index); return <button key={rank.name} type="button" onClick={() => onSelect(index)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected === index ? "text-white" : "text-muted hover:text-white"}`} style={selected === index ? { borderColor: `${rank.color}88`, backgroundColor: `${rank.color}22`, color: rank.color } : { borderColor: "var(--border, #2a2a3a)" }}><RankIcon rank={info} size={24} />{rank.name}</button>; })}</div>;
}

export function LeaderboardTabs({ dailyLeaderboards, dailyCameraLeaderboards, challengeLeaderboards, rankedCameraLeaderboards, challengeLevelLeaderboard, currentUserId, initialRankIndex = 0 }: { dailyLeaderboards: DailyLeaderboardRow[][]; dailyCameraLeaderboards: CameraLeaderboards<DailyLeaderboardRow>; challengeLeaderboards: ChallengeRow[][]; rankedCameraLeaderboards: CameraLeaderboards<ChallengeRow>; challengeLevelLeaderboard: ChallengeLevelRow[]; currentUserId: string | null; initialRankIndex?: number }) {
  const [tab, setTab] = useState<"daily" | "ranked" | "challenge">("daily");
  const [rankedSection, setRankedSection] = useState<Section>("my-rank");
  const [rankedRank, setRankedRank] = useState(initialRankIndex);
  const globalDailyRows = [...dailyLeaderboards.flat()].sort((a, b) => b.streak - a.streak || b.lastBeatAt.getTime() - a.lastBeatAt.getTime()).map((row, index) => ({ ...row, position: index + 1 }));
  const globalRankedRows = [...challengeLeaderboards.flat()].sort((a, b) => b.rhp - a.rhp).map((row, index) => ({ ...row, position: index + 1 }));
  const renderRanked = () => { if (rankedSection === "global") return <ChallengeLeaderboard key="ranked-global" leaderboards={[globalRankedRows]} currentUserId={currentUserId} initialRankIndex={0} hideRankPicker />; if (rankedSection === "my-rank") return <ChallengeLeaderboard key="ranked-my-rank" leaderboards={challengeLeaderboards} currentUserId={currentUserId} initialRankIndex={initialRankIndex} />; const modeLabel = rankedSection === "lock" ? "Camera Lock" : rankedSection === "spin" ? "Camera Spin" : "VR"; const selectedRank = RANKS[rankedRank] ?? RANKS[0]; return <section key={`ranked-camera-${rankedSection}`} className="space-y-4"><div><p className="text-sm uppercase tracking-[0.24em] text-accent">{modeLabel} leaderboard</p><h2 className="mt-1 flex items-center gap-3 text-2xl font-semibold text-white"><RankIcon rank={rankInfoFor(rankedRank)} size={40} />{selectedRank.name} · {modeLabel}</h2><p className="mt-2 text-sm text-muted">Only users with the {modeLabel} tag appear here, ranked within the selected rank.</p></div><RankPicker selected={rankedRank} onSelect={setRankedRank} /><ChallengeLeaderboard key={`ranked-${rankedSection}-${rankedRank}`} leaderboards={rankedCameraLeaderboards[rankedSection]} currentUserId={currentUserId} initialRankIndex={rankedRank} hideRankPicker /></section>; };
  return <div className="space-y-6"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setTab("daily")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "daily" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Trophy size={16} /> Daily</button><button type="button" onClick={() => setTab("ranked")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "ranked" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Swords size={16} /> Ranked</button><button type="button" onClick={() => setTab("challenge")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "challenge" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Layers size={16} /> Challenge</button></div>{tab === "daily" ? <DailyLeaderboard leaderboards={[globalDailyRows]} currentUserId={currentUserId} initialRankIndex={0} hideRankPicker /> : tab === "ranked" ? <section className="space-y-6"><SectionTabs selected={rankedSection} onSelect={setRankedSection} initialRankIndex={initialRankIndex} />{renderRanked()}</section> : <ChallengeLevelLeaderboard key="challenge-level" rows={challengeLevelLeaderboard} currentUserId={currentUserId} />}</div>;
}
