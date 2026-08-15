import Link from "next/link";
import type { RhythiaScore } from "@/lib/rhythia";

const titles = ["Novice", "Expert", "Candidate Master", "Master", "Candidate Grandmaster", "Grandmaster"];

function scoreDetails(score: RhythiaScore) {
  const accuracy = score.misses === null || !score.beatmapNotes ? null : Math.round((1 - score.misses / score.beatmapNotes) * 10000) / 100;
  const grade = !score.passed || accuracy === null ? "F" : accuracy === 100 ? "SS" : accuracy >= 98 ? "S" : accuracy >= 95 ? "A" : accuracy >= 90 ? "B" : accuracy >= 85 ? "C" : accuracy >= 80 ? "D" : "F";
  return { accuracy, grade };
}

export function RhythiaStats({ profile }: { profile: { profileId: number; profileUrl: string; username: string | null; country: string | null; flag: string | null; globalRank: number | null; countryRank: number | null; rhythmPoints: number | null; title: string; scores: unknown } }) {
  const scores = Array.isArray(profile.scores) ? profile.scores as RhythiaScore[] : [];
  const currentTitle = Math.max(0, titles.indexOf(profile.title));
  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Rhythia profile</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{profile.username ?? "Connected player"}</h2>
          <Link href={profile.profileUrl} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-muted hover:text-accent">View on Rhythia ↗</Link>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2 text-sm text-white">
          {profile.flag && <img src={`https://production.rhythia.com/flags/${profile.flag}.svg`} alt={`${profile.country ?? profile.flag} flag`} className="h-4 w-6 rounded-sm object-cover" />}
          {profile.country ?? "Unknown country"}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[['Global rank', profile.globalRank ? `#${profile.globalRank.toLocaleString()}` : "—"], ['Country rank', profile.countryRank ? `#${profile.countryRank.toLocaleString()}` : "—"], ['Rhythm points', profile.rhythmPoints === null ? "—" : profile.rhythmPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
        <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-[0.16em] text-muted">Title progression</p><p className="text-sm font-semibold text-accent">{profile.title}</p></div>
        <div className="mt-4 grid grid-cols-6 gap-1.5">{titles.map((title, index) => <div key={title} className={`h-2 rounded-full ${index <= currentTitle ? "bg-accent" : "bg-white/10"}`} title={title} />)}</div>
        <div className="mt-2 flex justify-between text-[10px] text-muted"><span>Novice</span><span>Grandmaster</span></div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-white">Top scores</h3><span className="text-xs uppercase tracking-[0.16em] text-muted">Best plays</span></div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border">
          {scores.length === 0 ? <p className="p-5 text-sm text-muted">No top scores available.</p> : scores.map((score, index) => {
            const { accuracy, grade } = scoreDetails(score);
            return <div key={score.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/60 px-4 py-3 last:border-0 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_4rem_3rem_4rem]">
              <span className="text-sm text-muted">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{score.beatmapTitle ?? "Unknown map"}</p><p className="mt-1 text-xs text-muted">{score.speed ? `${score.speed.toFixed(2)}x` : "1.00x"} speed · {score.misses ?? "—"} misses</p></div>
              <span className="text-right text-sm text-accent">{score.awarded_sp ?? "—"} RP</span><span className="hidden text-right text-sm text-muted sm:block">{score.speed ? `${score.speed.toFixed(2)}x` : "1.00x"}</span><span className="hidden text-right text-sm text-muted sm:block">{score.misses ?? "—"}</span><span className="text-right text-sm font-bold text-white">{grade} <span className="hidden font-normal text-muted sm:inline">{accuracy === null ? "—" : `${accuracy.toFixed(2)}%`}</span></span>
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}
