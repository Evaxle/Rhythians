"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Crown, RefreshCw, Trophy, UserX } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { rankLabel } from "@/lib/ranks";

type LeaderboardEntry = {
  position: number;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  discordId: string | null;
  accuracy: number | null;
  points: number;
  rhp: number;
  rankInfo: RankInfo;
};

type LeaderboardData = {
  mapId: string;
  title: string;
  rating: number;
  rankIndex: number;
  rankName: string;
  rankColor: string;
  rankMinRating: number;
  rankMaxRating: number;
  entries: LeaderboardEntry[];
  viewer: { position: number; accuracy: number | null; points: number } | null;
  viewerRemoved: boolean;
};

const POLL_MS = 15000;

export function MapLeaderboard({ mapId, refreshSignal }: { mapId: string; refreshSignal: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const fetchLeaderboard = useCallback(async () => {
    if (!openRef.current) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/maps/${mapId}/leaderboard`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the leaderboard.");
      const body = (await response.json()) as LeaderboardData;
      setData(body);
    } catch {
      setError("Unable to load the leaderboard.");
    } finally {
      setLoading(false);
    }
  }, [mapId]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchLeaderboard();
    }
  }, [open, fetchLeaderboard]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => void fetchLeaderboard(), POLL_MS);
    return () => clearInterval(timer);
  }, [open, fetchLeaderboard]);

  useEffect(() => {
    if (refreshSignal > 0 && openRef.current) void fetchLeaderboard();
  }, [refreshSignal, fetchLeaderboard]);

  function avatarUrl(entry: LeaderboardEntry): string | null {
    if (!entry.avatar) return null;
    if (entry.avatar.startsWith("http://") || entry.avatar.startsWith("https://")) return entry.avatar;
    if (entry.discordId) return `https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=64`;
    return null;
  }

  const medal = (position: number) =>
    position === 1 ? "bg-amber-400/20 text-amber-300 border-amber-400/40" : position === 2 ? "bg-slate-300/15 text-slate-200 border-slate-300/40" : position === 3 ? "bg-orange-400/15 text-orange-300 border-orange-400/40" : "bg-white/5 text-muted border-border";

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40"
      >
        <span className="inline-flex items-center gap-2">
          <Trophy size={15} className="text-accent" /> Top 10 leaderboard
          {data && <span className="text-xs font-normal text-muted">· {data.rankName}</span>}
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <p className="text-xs text-muted">
              <span className="font-semibold" style={{ color: data?.rankColor }}>
                {data?.rankName ?? "—"}
              </span>{" "}
              only · maps rated {data ? `${data.rankMinRating.toFixed(2)} – ${data.rankMaxRating.toFixed(2)}` : "—"}
            </p>
            <button
              type="button"
              onClick={() => void fetchLeaderboard()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted transition hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {error && !data ? (
            <p className="px-1 pb-2 text-xs text-red-300">{error}</p>
          ) : !data && loading ? (
            <p className="flex items-center gap-2 px-1 py-3 text-xs text-muted">
              <RefreshCw size={13} className="animate-spin" /> Loading leaderboard...
            </p>
          ) : data ? (
            <>
              {data.entries.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted">
                  No scores yet. Beat this map as a {data.rankName} player to take the top spot!
                </p>
              ) : (
                <ol className="space-y-1">
                  {data.entries.map((entry) => (
                    <li key={entry.userId} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/5">
                      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${medal(entry.position)}`}>
                        {entry.position === 1 ? <Crown size={13} /> : entry.position}
                      </span>
                      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-white/5">
                        {avatarUrl(entry) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl(entry)!} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted">
                            {entry.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/profile/${entry.profileHandle}`} className="block truncate text-sm font-semibold text-white hover:text-accent">
                          {entry.displayName ?? entry.username}
                        </Link>
                        <p className="text-xs text-muted">
                          <span style={{ color: entry.rankInfo.color }}>{rankLabel(entry.rankInfo)}</span> · {entry.rhp.toLocaleString()} RHP
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-white">{entry.accuracy != null ? `${entry.accuracy.toFixed(2)}%` : "—"}</p>
                        <p className="text-xs text-muted">{entry.points} RHP</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-2 border-t border-border pt-2">
                {data.viewer ? (
                  <p className="flex items-center gap-2 px-1 text-xs font-semibold text-accent">
                    <Trophy size={13} /> Your position: #{data.viewer.position} · {data.viewer.accuracy != null ? `${data.viewer.accuracy.toFixed(2)}%` : "—"}
                  </p>
                ) : data.viewerRemoved ? (
                  <p className="flex items-center gap-2 px-1 text-xs text-amber-300">
                    <UserX size={13} /> You completed this map, but you&apos;ve ranked up past this board&apos;s rank so your score is no longer listed.
                  </p>
                ) : null}
                <p className="mt-1 px-1 text-[11px] leading-5 text-muted/70">
                  Only players currently in the {data.rankName} rank count. Ranking up removes your score from this leaderboard.
                </p>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}