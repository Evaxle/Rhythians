import Link from "next/link";
import { Check, CircleCheck, Lock, Play, Sparkles } from "lucide-react";
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

export default async function PathPage() {
  const user = await getSessionUser();
  const path = await getSeasonalPath(user?.id);
  const activePathIndex = Math.min(Math.max(path.completedRank + 1, 0), path.ranks.length - 1);
  const activeRank = path.ranks[activePathIndex];
  const themeColor = activeRank?.color ?? "#7289da";

  return <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden rounded-[2rem]" style={{ background: `radial-gradient(circle at 50% 0%, ${themeColor}24, transparent 48%), linear-gradient(180deg, ${themeColor}10 0%, transparent 45%)` }}>
    <div className="relative mx-auto max-w-4xl space-y-8 px-2 py-4">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 text-center shadow-glow" style={{ borderColor: `${themeColor}55`, boxShadow: `0 20px 70px ${themeColor}14` }}>
        <p className="text-sm uppercase tracking-[0.3em]" style={{ color: themeColor }}>Seasonal progression</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Seasonal Rhythian Path</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Complete one ranked map at a time to progress through this season's path. Each completed rank earns its seasonal rank at the end of the season.</p>
        <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-accent/25 bg-accent/10 p-4 text-left text-sm leading-6 text-muted"><p className="font-semibold text-white">How path completion works</p><p className="mt-1">You must <span className="font-semibold text-white">repass the path map</span> for your current path rank. An older pass already on your Rhythia profile does not count. The pass must appear in your <span className="font-semibold text-white">recent scores</span> and must have <span className="font-semibold text-white">normal speed (1.0x)</span> with no speed modification. Top/older scores and modified-speed passes cannot complete a path rank.</p></div>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: `${themeColor}55`, backgroundColor: `${themeColor}14`, color: themeColor }}><Sparkles size={16} /> Season {path.season.seasonNumber}</div>
        <p className="mt-3 text-xs text-muted">{path.season.startsAt.toLocaleDateString()} – {path.season.endsAt.toLocaleDateString()}</p>
        <SeasonCountdown endsAt={path.season.endsAt.toISOString()} />
        {user && <p className="mt-4 text-sm text-muted">Your regular rank allows you to play through <span className="font-semibold text-white">{path.ranks[path.maxPlayableRank]?.name}</span> on the path.</p>}
      </section>

      <section className="relative space-y-4">
        {path.ranks.map((rank) => {
          const map = rank.map;
          const targetName = rank.index === path.ranks.length - 1 ? "4.00 rating" : path.ranks[rank.index + 1].name;
          const aboveRegularRank = Boolean(user) && rank.index > path.maxPlayableRank;
          const locked = !map || !map.unlocked;
          const ranked = map?.ranked === true;
          const lengthLabel = formatLength(map?.map?.length);
          return <div key={rank.name} className={`relative rounded-3xl border p-6 transition ${locked ? "border-border bg-background/40 opacity-45 grayscale" : map?.completed ? "border-emerald-400/30 bg-emerald-400/[0.06] shadow-glow" : "border-border bg-surface/95 shadow-glow"}`} style={!locked && !map?.completed ? { borderColor: `${rank.color}55`, boxShadow: `0 18px 55px ${rank.color}0d` } : undefined}>
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold" style={{ borderColor: map?.completed ? "#34d399" : rank.color, color: map?.completed ? "#34d399" : rank.color, backgroundColor: map?.completed ? "rgba(52,211,153,0.10)" : `${rank.color}18` }}>{map?.completed ? <Check size={25} /> : locked ? <Lock size={22} /> : rank.index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold" style={{ color: locked ? undefined : map?.completed ? "#34d399" : rank.color }}>{rank.name}</h2>{map?.completed && <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Completed</span>}{!map?.completed && !locked && <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">Next path map</span>}{aboveRegularRank && <span className="rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted">Requires {rank.name} rank</span>}</div>
                <p className="mt-1 text-sm text-muted">Complete a {targetName} map to earn the {rank.name} seasonal rank.</p>
                {map?.map ? <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-lg font-semibold text-white">{map.map.title}</p>{map.map.artist && <p className="mt-1 text-sm text-muted">{map.map.artist}</p>}<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted"><span>{map.map.rating?.toFixed(2)} rating</span>{lengthLabel && <span>{lengthLabel}</span>}{map.map.mapperName && <span>Mapped by {map.map.mapperName}</span>}{ranked ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-300"><CircleCheck size={14} /> Ranked map verified</span> : <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 font-semibold text-red-300"><CircleCheck size={14} /> Ranked status could not be verified</span>}</div></div>{map.map.mapFileUrl && !locked && !map.completed && <a href={map.map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"><Play size={15} /> Play map</a>}{map.completed && <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300"><Check size={15} /> Passed</span>}</div>
                  {user && !locked && !map.completed && <CheckRecentScoreButton rankIndex={rank.index} completed={false} />}<div className="mt-4"><ReportButton targetType="challenge_map" targetId={map.map.id} targetLabel="this path map" reasons={["Path map needs to be reset", "Map is not ranked", "Broken or misleading content", "Other"]} /></div>
                </div> : <div className="mt-5 rounded-2xl border border-dashed border-border p-4 text-sm text-muted">No approved ranked map is currently available for this path rank.</div>}
              </div>
            </div>
          </div>;
        })}
      </section>

      {user && <section className="rounded-3xl border border-border bg-surface/95 p-6 text-sm text-muted shadow-glow" style={{ borderColor: `${themeColor}55` }}><p className="font-semibold text-white">Your path progress</p><p className="mt-2">{path.completedRank < 0 ? "No path maps completed yet. Start with Copper." : path.completedRank >= path.ranks.length - 1 ? "You have completed the full seasonal path." : `You have completed through ${path.ranks[path.completedRank].name}. Your next map is ${path.ranks[path.completedRank + 1].name}.`}</p><Link href={`/profile/${user.profileHandle}`} className="mt-4 inline-flex rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-accent/40">View profile</Link></section>}
    </div>
    {user && <SeasonRewardPopups />}
  </div>;
}
