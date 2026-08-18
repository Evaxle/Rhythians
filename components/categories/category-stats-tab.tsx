"use client";

import { MAX_CATEGORY_LEVEL, type Category } from "@/lib/category-constants";

type Stats = {
  category: Category;
  label: string;
  level: number;
  completions: number;
  mapsAtNextLevel: number;
  mapsCompletedAtNextLevel: number;
};

export function CategoryStatsTab({ stats }: { stats: Stats[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow">
        <p className="text-sm text-muted">Your progress across every skill category.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map((stat) => {
          const isMax = stat.level >= MAX_CATEGORY_LEVEL;
          const progress = isMax ? 1 : stat.mapsAtNextLevel > 0 ? Math.min(1, stat.mapsCompletedAtNextLevel / stat.mapsAtNextLevel) : 0;
          return (
            <div key={stat.category} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.24em] text-accent">{stat.label}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-sm font-semibold text-white">
                  Level {stat.level}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted">
                <p>
                  Maps completed: <span className="font-semibold text-white">{stat.completions}</span>
                </p>
                {isMax ? (
                  <p className="text-emerald-300">Max level reached!</p>
                ) : (
                  <p>
                    Next level ({stat.level + 1}):{" "}
                    <span className="font-semibold text-white">
                      {stat.mapsCompletedAtNextLevel}/{stat.mapsAtNextLevel}
                    </span>{" "}
                    map{stat.mapsAtNextLevel === 1 ? "" : "s"} completed
                  </p>
                )}
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-muted">
                {isMax ? "100%" : `${Math.round(progress * 100)}% to level ${stat.level + 1}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
