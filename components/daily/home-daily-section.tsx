import Link from "next/link";
import { ArrowRight, CalendarDays, Download, Link2, LogIn, Star, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateDailyMap, getUserDailyStatus, formatDailyDate, rhpForMap } from "@/lib/daily";

export async function HomeDailySection() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
          <CalendarDays size={18} /> Daily map
        </div>
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <LogIn size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Sign in to access the daily map</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              A new ranked map every day with Rhythian Points on the line. Sign in and link your Rhythia account to
              take part.
            </p>
            <Link href="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
              Sign in <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

  if (!profile) {
    return (
      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
          <CalendarDays size={18} /> Daily map
        </div>
        <div className="mt-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Link2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Link your Rhythia account to play</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              The daily map, leaderboards, and Rhythian Points are reserved for members with a linked Rhythia profile.
            </p>
            <Link href={`/profile/${user.profileHandle}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-white">
              Link your account <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const daily = await getOrCreateDailyMap();
  const status = await getUserDailyStatus(user.id);
  const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { rhp: true } });

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-accent">
          <CalendarDays size={18} /> Daily map
        </div>
        {userRow && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            {userRow.rhp.toLocaleString()} RHP
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-muted">{formatDailyDate(daily.date)}</p>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">{daily.artist ?? "Unknown artist"}</p>
          <h3 className="mt-1 truncate text-xl font-semibold text-white">{daily.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-white">
              <Star className="h-4 w-4 text-amber-400" fill="currentColor" /> {daily.starRating.toFixed(2)}
            </span>
            <span>·</span>
            <span>Mapped by {daily.mapperName ?? "Unknown"}</span>
            <span>·</span>
            <span className="font-semibold text-accent">{rhpForMap(daily.starRating)} RHP</span>
          </div>
          {status?.beat && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <CheckCircle2 size={14} /> Beaten · {status.beat.points} RHP earned
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <a
            href={daily.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"
          >
            <Download size={15} /> Download map
          </a>
          <Link href="/daily" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent/40">
            View daily <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}