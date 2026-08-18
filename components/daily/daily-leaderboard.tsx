import Link from "next/link";
import { Medal } from "lucide-react";
import type { DailyLeaderboardRow } from "@/lib/daily";

const medalColors = ["text-amber-400", "text-slate-300", "text-amber-700"];

export function DailyLeaderboardTable({ rows }: { rows: DailyLeaderboardRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {rows.length === 0 ? (
        <p className="p-8 text-sm text-muted">No one has beaten a daily map this month yet. Be the first!</p>
      ) : (
        rows.map((row, index) => {
          const medal = index < 3 ? medalColors[index] : "text-muted";
          return (
            <div
              key={row.userId}
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/60 px-4 py-3 last:border-0 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_6rem_6rem]"
            >
              <span className={`text-sm font-semibold ${medal}`}>
                {index < 3 ? <Medal size={18} /> : index + 1}
              </span>
              <div className="min-w-0">
                <Link href={`/profile/${row.profileHandle}`} className="truncate text-sm font-semibold text-white hover:text-accent">
                  {row.displayName ?? row.username}
                </Link>
                <p className="mt-0.5 text-xs text-muted">{row.totalPoints.toLocaleString()} RHP earned this month</p>
              </div>
              <span className="hidden text-right text-sm text-muted sm:block">
                Last: {row.lastBeatAt.toLocaleDateString()}
              </span>
              <span className="hidden text-right text-sm text-muted sm:block">#{index + 1}</span>
              <span className="text-right text-lg font-semibold text-white">{row.count}</span>
            </div>
          );
        })
      )}
    </div>
  );
}