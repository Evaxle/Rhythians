"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, type Category } from "@/lib/category-constants";
import { CategoryPills } from "@/components/categories/category-pills";

type Row = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  level: number;
  completions: number;
};

export function CategoryLeaderboardTab({
  category,
  onCategoryChange,
  currentUserId,
}: {
  category: Category;
  onCategoryChange: (category: Category) => void;
  currentUserId: string | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/categories/leaderboard?category=${encodeURIComponent(category)}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Unable to load the leaderboard.");
        if (!cancelled) {
          setRows(body.rows ?? []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load the leaderboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            Leaderboard: <span className="font-semibold text-white">{CATEGORY_LABELS[category]}</span>
          </p>
          <p className="mt-1 text-xs text-muted">Ranked by level, then by maps completed in the category.</p>
        </div>
        <CategoryPills selected={category} onSelect={onCategoryChange} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        {loading ? (
          <p className="p-8 text-sm text-muted">Loading leaderboard...</p>
        ) : error ? (
          <p className="p-8 text-sm text-red-300">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-sm text-muted">No one has leveled up in {CATEGORY_LABELS[category]} yet. Be the first!</p>
        ) : (
          rows.map((row) => {
            const isCurrentUser = row.userId === currentUserId;
            return (
              <div
                key={row.userId}
                className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem] ${
                  isCurrentUser ? "bg-accent/10" : "bg-background/60"
                }`}
              >
                <span className="text-sm font-bold text-muted">{row.position}</span>
                <div className="flex min-w-0 items-center gap-3">
                  {row.avatar ? (
                    <img src={row.avatar} alt={row.displayName ?? row.username} className="h-8 w-8 shrink-0 rounded-full border border-border" />
                  ) : (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-xs font-bold text-accent">
                      {row.displayName?.charAt(0) ?? row.username.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link href={`/profile/${row.profileHandle}`} className={`truncate text-sm font-semibold hover:text-accent ${isCurrentUser ? "text-accent" : "text-white"}`}>
                      {row.displayName ?? row.username}
                      {isCurrentUser ? " (you)" : ""}
                    </Link>
                    <p className="text-xs text-muted">@{row.profileHandle}</p>
                  </div>
                </div>
                <span className="hidden text-right text-sm text-muted sm:block">{row.completions} map{row.completions === 1 ? "" : "s"}</span>
                <span className="text-right text-sm font-semibold text-white">Level {row.level}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
