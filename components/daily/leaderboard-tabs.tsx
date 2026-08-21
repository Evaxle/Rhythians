"use client";

import { useState } from "react";
import { Trophy, Swords, Layers } from "lucide-react";
import { DailyLeaderboard, type DailyLeaderboardRow } from "@/components/daily/daily-leaderboard";
import { ChallengeLeaderboard, type ChallengeRow } from "@/components/daily/challenge-leaderboard";
import { ChallengeLevelLeaderboard, type ChallengeLevelRow } from "@/components/daily/challenge-level-leaderboard";
import { RANKS } from "@/lib/ranks";

type CameraMode = "lock" | "spin" | "vr";
type Section = "global" | "my-rank" | CameraMode;
type CameraLeaderboards<T> = Record<CameraMode, T[][]>;

function SectionTabs({ selected, onSelect, initialRankIndex }: { selected: Section; onSelect: (section: Section) => void; initialRankIndex: number }) {
  return <div className="flex flex-wrap gap-2">{(["global", "my-rank", "lock", "spin", "vr"] as const).map((section) => <button key={section} type="button" onClick={() => onSelect(section)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selected === section ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>{section === "global" ? "Global" : section === "my-rank" ? `My Rank · ${RANKS[initialRankIndex]?.name ?? "My Rank"}` : section === "lock" ? "Camera Lock" : section === "spin" ? "Camera Spin" : "VR"}</button>)}</div>;
}

function RankPicker({ selected, onSelect }: { selected: number; onSelect: (rank: number) => void }) {
  return <div className="flex flex-wrap gap-2">{RANKS.map((rank, index) => <button key={rank.name} type="button" onClick={() => onSelect(index)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected === index ? "text-white" : "text-muted hover:text-white"}`} style={selected === index ? { borderColor: `${rank.color}88`, backgroundColor: `${rank.color}22`, color: rank.color } : { borderColor: "var(--border, #2a2a3a)" }}>{rank.name}</button>)}</div>;
}

export function LeaderboardTabs({ dailyLeaderboards, dailyCameraLeaderboards, challengeLeaderboards, rankedCameraLeaderboards, challengeLevelLeaderboard, currentUserId, initialRankIndex = 0 }: { dailyLeaderboards: DailyLeaderboardRow[][]; dailyCameraLeaderboards: CameraLeaderboards<DailyLeaderboardRow>; challengeLeaderboards: ChallengeRow[][]; rankedCameraLeaderboards: CameraLeaderboards<ChallengeRow>; challengeLevelLeaderboard: ChallengeLevelRow[]; currentUserId: string | null; initialRankIndex?: number }) {
  const [tab, setTab] = useState<"daily" | "ranked" | "challenge">("daily");
  const [dailySection, setDailySection] = useState<Section>("my-rank");
  const [rankedSection, setRankedSection] = useState<Section>("my-rank");
  const [dailyRank, setDailyRank] = useState(initialRankIndex);
  const [rankedRank, setRankedRank] = useState(initialRankIndex);

  const globalDailyRows = [...dailyLeaderboards.flat()].sort((a, b) => b.streak - a.streak || b.lastBeatAt.getTime() - a.lastBeatAt.getTime()).map((row, index) => ({ ...row, position: index + 1 }));
  const globalRankedRows = [...challengeLeaderboards.flat()].sort((a, b) => b.rhp - a.rhp).map((row, index) => ({ ...row, position: index + 1 }));

  const renderDaily = () => {
    if (dailySection === "global") return <DailyLeaderboard leaderboards={[globalDailyRows]} currentUserId={currentUserId} initialRankIndex={0} hideRankPicker />;
    if (dailySection === "my-rank") return <DailyLeaderboard leaderboards={dailyLeaderboards} currentUserId={currentUserId} initialRankIndex={initialRankIndex} />;
    const modeLabel = dailySection === "lock" ? "Camera Lock" : dailySection === "spin" ? "Camera Spin" : "VR";
    const selectedRank = RANKS[dailyRank] ?? RANKS[0];
    return <section className="space-y-4"><div><p className="text-sm uppercase tracking-[0.24em] text-accent">{modeLabel} leaderboard</p><h2 className="mt-1 text-2xl font-semibold text-white">{selectedRank.name} · {modeLabel}</h2><p className="mt-2 text-sm text-muted">Only users with the {modeLabel} tag appear here, ranked within the selected rank.</p></div><RankPicker selected={dailyRank} onSelect={setDailyRank} /><DailyLeaderboard leaderboards={dailyCameraLeaderboards[dailySection]} currentUserId={currentUserId} initialRankIndex={dailyRank} hideRankPicker /></section>;
  };

  const renderRanked = () => {
    if (rankedSection === "global") return <ChallengeLeaderboard leaderboards={[globalRankedRows]} currentUserId={currentUserId} initialRankIndex={0} hideRankPicker />;
    if (rankedSection === "my-rank") return <ChallengeLeaderboard leaderboards={challengeLeaderboards} currentUserId={currentUserId} initialRankIndex={initialRankIndex} />;
    const modeLabel = rankedSection === "lock" ? "Camera Lock" : rankedSection === "spin" ? "Camera Spin" : "VR";
    const selectedRank = RANKS[rankedRank] ?? RANKS[0];
    return <section className="space-y-4"><div><p className="text-sm uppercase tracking-[0.24em] text-accent">{modeLabel} leaderboard</p><h2 className="mt-1 text-2xl font-semibold text-white">{selectedRank.name} · {modeLabel}</h2><p className="mt-2 text-sm text-muted">Only users with the {modeLabel} tag appear here, ranked within the selected rank.</p></div><RankPicker selected={rankedRank} onSelect={setRankedRank} /><ChallengeLeaderboard leaderboards={rankedCameraLeaderboards[rankedSection]} currentUserId={currentUserId} initialRankIndex={rankedRank} hideRankPicker /></section>;
  };

  return <div className="space-y-6"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setTab("daily")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "daily" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Trophy size={16} /> Daily</button><button type="button" onClick={() => setTab("ranked")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "ranked" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Swords size={16} /> Ranked</button><button type="button" onClick={() => setTab("challenge")} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === "challenge" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:border-accent/40 hover:text-white"}`}><Layers size={16} /> Challenge</button></div>{tab === "daily" ? <section className="space-y-6"><SectionTabs selected={dailySection} onSelect={setDailySection} initialRankIndex={initialRankIndex} />{renderDaily()}</section> : tab === "ranked" ? <section className="space-y-6"><SectionTabs selected={rankedSection} onSelect={setRankedSection} initialRankIndex={initialRankIndex} />{renderRanked()}</section> : <ChallengeLevelLeaderboard rows={challengeLevelLeaderboard} currentUserId={currentUserId} />}</div>;
}
