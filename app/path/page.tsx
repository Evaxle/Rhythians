import Link from "next/link";
import { Check, CircleCheck, Download, Lock, Play, Sparkles, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getSeasonalPath } from "@/lib/seasonal-path";
import { CheckRecentScoreButton } from "@/components/path/check-recent-score-button";
import { SeasonCountdown } from "@/components/path/season-countdown";
import { SeasonRewardPopups } from "@/components/path/season-reward-popups";
import { ReportButton } from "@/components/report-button";

export const dynamic = "force-dynamic";

function formatLength(length: number | null | undefined) {
  if (length == null) return null;
  const totalSeconds = Math.max(0, Math.round(length / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function PathCard({ rank, completed, current, locked, user }: { rank: Awaited<ReturnType<typeof getSeasonalPath>>["ranks"][number]; completed: boolean; current: boolean; locked: boolean; user: Awaited<ReturnType<typeof getSessionUser>> }) {
  const map = rank.map;
  const lengthLabel = formatLength(map?.map?.length);
  return <article className={`relative w-full min-w-0 flex-1 rounded-[2rem] border p-5 transition duration-300 sm:min-w-[330px] ${locked ? "border-white/10 bg-black/20 opacity-45 grayscale" : completed ? "border-emerald-400/30 bg-[linear-gradient(145deg,rgba(52,211,153,0.12),rgba(10,18,19,0.92))] shadow-[0_20px_70px_rgba(16,185,129,0.08)]" : current ? "border-white/20 bg-[linear-gradient(145deg,rgba(124,143,240,0.14),rgba(20,27,45,0.96))] shadow-[0_24px_80px_rgba(124,143,240,0.12)]" : "border-white/10 bg-background/45"}`} style={!locked && current ? { borderColor: `${rank.color}88`, boxShadow: `0 24px 80px ${rank.color}18` } : undefined}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border" style={{ borderColor: locked ? "rgba(255,255,255,.1)" : completed ? "rgba(52,211,153,.45)" : `${rank.color}66`, background: completed ? "rgba(52,211,153,.10)" : locked ? "rgba(255,255,255,.04)" : `${rank.color}16`, color: completed ? "#34d399" : locked ? "#8d99b5" : rank.color }}>{completed ? <Check size={22} /> : locked ? <Lock size={21} /> : rank.index + 1}</div><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">{current ? "Current rank" : completed ? "Completed" : "Next rank"}</p><h2 className="mt-1 text-xl font-semibold text-white">{rank.name}</h2></div></div>{current && <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">You are here</span>}</div>

    {map?.map ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
      <div><p className="truncate text-base font-semibold text-white">{map.map.title}</p>{map.map.artist && <p className="mt-1 truncate text-sm text-muted">{map.map.artist}</p>}<div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted"><span>{map.map.rating?.toFixed(2)} rating</span>{lengthLabel && <span>{lengthLabel}</span>}{map.map.mapperName && <span>Mapped by {map.map.mapperName}</span>}{map.ranked ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 font-semibold text-emerald-300"><CircleCheck size={12} /> Ranked</span> : <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Rank status unavailable</span>}</div></div>
      {current && user && !locked && !map.completed && <CheckRecentScoreButton rankIndex={rank.index} completed={false} />}
      {current && map.map.mapFileUrl && !locked && !map.completed && <a href={map.map.mapFileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent2"><Play size={15} /> Play map</a>}
      {completed && <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-sm font-semibold text-emerald-300"><Check size={15} /> Passed</div>}
      {current && user && !locked && <div className="mt-3"><ReportButton targetType="challenge_map" targetId={map.map.id} targetLabel="this path map" reasons={["Path map needs to be reset", "Map is not ranked", "Broken or misleading content", "Other"]} /></div>}
      {locked && <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-muted"><Lock size={15} /> Reach this rank to unlock</div>}
    </div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-muted">{locked ? "This rank is locked until you progress through the path." : "No approved ranked map is currently available for this path rank."}</div>}
  </article>;
}

export default async function PathPage() {
  const user = await getSessionUser();
  const path = await getSeasonalPath(user?.id);
  const activePathIndex = Math.min(Math.max(path.completedRank + 1, 0), path.ranks.length - 1);
  const current = path.ranks[activePathIndex];
  const previous = activePathIndex > 0 ? path.ranks[activePathIndex - 1] : null;
  const next = activePathIndex < path.ranks.length - 1 ? path.ranks[activePathIndex + 1] : null;
  const themeColor = current?.color ?? "#7289da";

  return <div className="ui-page relative overflow-hidden rounded-[2rem] px-0 py-1" style={{ background: `radial-gradient(circle at 50% 0%, ${themeColor}20, transparent 38%), radial-gradient(circle at 8% 60%, ${themeColor}0d, transparent 28%), linear-gradient(180deg, ${themeColor}09 0%, transparent 52%, rgba(6,8,16,.15) 100%)` }}>
    <div className="relative space-y-6 px-1 py-2 sm:px-2">
      <section className="rounded-[2rem] border border-white/10 bg-black/10 p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="ui-kicker" style={{ color: themeColor }}>Seasonal progression</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white">Seasonal Rhythian Path</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A battle-pass style progression through the season. Complete the map in the center to unlock the next rank.</p></div><div className="flex flex-wrap items-center gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"><p className="ui-kicker text-muted">Season</p><p className="mt-1 text-sm font-semibold text-white">{path.season.seasonNumber}</p></div><SeasonCountdown endsAt={path.season.endsAt.toISOString()} /></div></div>
        {user && <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 text-sm text-muted"><span className="font-semibold text-white">Current progression:</span> {path.completedRank < 0 ? "Start with Copper." : path.completedRank >= path.ranks.length - 1 ? "You have completed the full seasonal path." : `Completed through ${path.ranks[path.completedRank].name}. Your next target is ${current.name}.`}</div>}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/10 p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4"><div><p className="ui-kicker text-muted">Battle pass</p><h2 className="mt-1 text-xl font-semibold text-white">Your path</h2></div><p className="hidden text-xs text-muted sm:block">Previous · Current · Next</p></div>
        <div className="flex flex-col items-stretch gap-3 px-0 pb-2 pt-2 sm:flex-row sm:items-center sm:gap-0 sm:overflow-x-auto sm:px-1 sm:pb-3 [scrollbar-width:thin]">
          {previous ? <><PathCard rank={previous} completed={Boolean(previous.map?.completed)} current={false} locked={false} user={user} /><div className="mx-auto h-8 w-1 bg-gradient-to-b from-emerald-400/70 to-accent/70 sm:mx-2 sm:h-1 sm:w-auto sm:min-w-10 sm:bg-gradient-to-r" /></> : <div className="hidden min-w-8 sm:block" />}
          <PathCard rank={current} completed={Boolean(current.map?.completed)} current={true} locked={!current.map?.unlocked} user={user} />
          {next ? <><div className="mx-auto h-8 w-1 bg-white/10 sm:mx-2 sm:h-1 sm:w-auto sm:min-w-10 sm:bg-gradient-to-r sm:from-accent/60 sm:to-white/10" /><PathCard rank={next} completed={false} current={false} locked={!next.map?.unlocked || next.index > path.maxPlayableRank} user={user} /></> : <div className="hidden min-w-8 sm:block" />}
        </div>
      </section>

      <section className="overflow-x-auto rounded-[2rem] border border-white/10 bg-black/10 p-4"><div className="flex min-w-max items-center gap-0 px-2">{path.ranks.map((rank, index) => { const done = index <= path.completedRank; const active = index === activePathIndex; return <div key={rank.name} className="flex items-center"><div className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold transition ${done ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300" : active ? "border-accent/45 bg-accent/10 text-accent" : "border-white/10 bg-white/5 text-muted"}`} style={active ? { borderColor: `${rank.color}88`, backgroundColor: `${rank.color}18`, color: rank.color } : undefined}>{done ? <Check size={14} /> : index + 1}</div>{index < path.ranks.length - 1 && <div className={`h-1 w-10 ${index < path.completedRank ? "bg-emerald-400/60" : index === path.completedRank ? "bg-gradient-to-r from-emerald-400/60 to-accent/70" : "bg-white/10"}`} />}</div>; })}</div></section>
    </div>
    {user && <SeasonRewardPopups />}
  </div>;
}
