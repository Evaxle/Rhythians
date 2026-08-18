"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, X } from "lucide-react";

type LeaderboardRow = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  accuracy: number | null;
  points: number;
  rankInfo: { name: string; tier: number; isExpert: boolean; color: string };
};

type LeaderboardData = {
  mapId: string;
  title: string;
  rating: number;
  rankIndex: number;
  rankName: string;
  rankColor: string;
  rangeMin: number;
  rangeMax: number;
  rows: LeaderboardRow[];
};

export function MapLeaderboard({
  mapId,
  currentUserId,
  onClose,
}: {
  mapId: string;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/maps/${mapId}/leaderboard`);
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Unable to load the leaderboard.");
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load the leaderboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} style={{ color: data?.rankColor ?? "var(--accent, #7c3aed)" }} />
          <p className="text-sm font-semibold text-white">Map leaderboard</p>
          {data && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              style={{ color: data.rankColor, borderColor: `${data.rankColor}55`, backgroundColor: `${data.rankColor}1a` }}
            >
              {data.rankName} only
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted transition hover:border-accent/40 hover:text-white"
          aria-label="Close leaderboard"
        >
          <X size={14} />
        </button>
      </div>

      {data && (
        <p className="mt-1 text-xs text-muted">
          Best passing scores on this map, from players currently in {data.rankName} ({data.rangeMin.toFixed(2)} –{" "}
          {data.rangeMax.toFixed(2)} rating). Rank up out of {data.rankName} and your score leaves this board.
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        {loading ? (
          <p className="p-5 text-sm text-muted">Loading leaderboard...</p>
        ) : error ? (
          <p className="p-5 text-sm text-red-300">{error}</p>
        ) : data && data.rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">No one in {data.rankName} has beaten this map yet. Be the first!</p>
        ) : (
          data?.rows.map((row) => {
            const isCurrentUser = row.userId === currentUserId;
            return (
              <div
                key={row.userId}
                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_4rem] ${
                  isCurrentUser ? "bg-accent/10" : "bg-background/60"
                }`}
              >
                <span className="text-sm font-bold text-muted">{row.position}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  {row.avatar ? (
                    <img src={row.avatar} alt={row.displayName ?? row.username} className="h-7 w-7 shrink-0 rounded-full border border-border" />
                  ) : (
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
                      style={{ color: row.rankInfo.color, borderColor: `${row.rankInfo.color}55`, backgroundColor: `${row.rankInfo.color}1a` }}
                    >
                      {row.rankInfo.isExpert ? "#" : row.rankInfo.tier}
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/profile/${row.profileHandle}`}
                      className={`truncate text-sm font-semibold hover:text-accent ${isCurrentUser ? "text-accent" : "text-white"}`}
                    >
                      {row.displayName ?? row.username}
                      {isCurrentUser ? " (you)" : ""}
                    </Link>
                    <p className="text-xs text-muted">
                      {row.rankInfo.isExpert ? "Expert" : `${row.rankInfo.name} ${row.rankInfo.tier}`}
                    </p>
                  </div>
                </div>
                <span className="hidden text-right text-sm text-muted sm:block">
                  {row.accuracy != null ? `${row.accuracy.toFixed(2)}%` : "—"}
                </span>
                <span className="text-right text-sm font-semibold text-white">{row.points} RHP</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
