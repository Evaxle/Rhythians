"use client";

import Image from "next/image";
import Link from "next/link";

export type ChallengeLevelRow = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatarUrl: string | null;
  level: number;
  completions: number;
};

export function ChallengeLevelLeaderboard({ rows, currentUserId }: { rows: ChallengeLevelRow[]; currentUserId: string | null }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-accent">Challenge</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Challenge Level leaderboard</h2>
        <p className="mt-1 text-sm text-muted">Players are ranked by their highest sequential Challenge Level, then completed maps.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        {rows.length === 0 ? <p className="p-8 text-sm text-muted">No Challenge players yet.</p> : rows.map((row) => {
          const current = row.userId === currentUserId;
          return <div key={row.userId} className={`grid grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${current ? "bg-accent/10" : "bg-background/60"}`}>
            <span className="text-sm font-bold text-muted">{row.position}</span>
            <Link href={`/profile/${row.profileHandle}`} aria-label={`View ${row.displayName ?? row.username}'s profile`} className="relative h-10 w-10 overflow-hidden rounded-full border border-border bg-white/5">
              {row.avatarUrl ? <Image src={row.avatarUrl} alt="" fill sizes="40px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-bold text-muted">{(row.displayName ?? row.username).slice(0, 1).toUpperCase()}</span>}
            </Link>
            <div className="min-w-0">
              <Link href={`/profile/${row.profileHandle}`} className={`truncate text-sm font-semibold hover:text-accent ${current ? "text-accent" : "text-white"}`}>{row.displayName ?? row.username}{current ? " (you)" : ""}</Link>
              <p className="text-xs text-muted">{row.completions} map{row.completions === 1 ? "" : "s"} completed</p>
            </div>
            <span className="text-right text-sm font-semibold text-white">Level {row.level}</span>
          </div>;
        })}
      </div>
    </section>
  );
}
