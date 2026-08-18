"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, Map as MapIcon, RefreshCw, Star, XCircle, ChevronDown } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { isMapInRankRange } from "@/lib/ranks";

const PAGE_SIZE = 40;

type MapEntry = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  rating: number | null;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  completion: { passed: boolean; points: number } | null;
  submittedBy: { displayName: string | null; username: string } | null;
};

export function MapsBrowser({
  maps,
  rankInfo,
  userRhp,
}: {
  maps: MapEntry[];
  rankInfo: RankInfo;
  userRhp: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, { tone: "ok" | "warn" | "err"; text: string }>>({});

  const filtered = useMemo(() => {
    if (showAll) return maps;
    return maps.filter((map) => map.rating != null && isMapInRankRange(map.rating, rankInfo.index));
  }, [maps, showAll, rankInfo]);

  const outOfRangeCount = maps.length - filtered.length;
  const visibleMaps = filtered.slice(0, visibleCount);

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: { tone: "ok", text: "Checking your scores..." } }));
    try {
      const response = await fetch("/api/maps/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapId: id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessages((current) => ({ ...current, [id]: { tone: "err", text: data.error ?? "Unable to check your scores." } }));
        return;
      }
      if (data.status === "beat") {
        setMessages((current) => ({ ...current, [id]: { tone: "ok", text: `You earned ${data.points} RHP! (${data.accuracy != null ? data.accuracy.toFixed(2) + "% accuracy" : "pass"})` } }));
      } else if (data.status === "already") {
        setMessages((current) => ({ ...current, [id]: { tone: "ok", text: "You already earned RHP for this map." } }));
      } else if (data.status === "failed") {
        setMessages((current) => ({ ...current, [id]: { tone: "warn", text: `Attempt recorded. You lost ${Math.abs(data.points)} RHP.` } }));
      } else if (data.status === "out_of_range") {
        setMessages((current) => ({ ...current, [id]: { tone: "warn", text: "This map is outside your rank's rating range. Complete it with a passing score in Rhythia to earn RHP." } }));
      } else {
        setMessages((current) => ({ ...current, [id]: { tone: "warn", text: "No score found for this map yet. Beat it in Rhythia and check again." } }));
      }
    } catch {
      setMessages((current) => ({ ...current, [id]: { tone: "err", text: "Unable to reach the server. Try again." } }));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            Your rank: <span className="font-semibold" style={{ color: rankInfo.color }}>{rankInfo.isUnnamed ? "Unnamed" : `${rankInfo.name} ${rankInfo.tier}`}</span> · {userRhp.toLocaleString()} RHP
          </p>
          <p className="mt-1 text-xs text-muted">
            Allowed rating range: <span className="font-semibold text-white">{rankInfo.rangeMin.toFixed(2)} – {rankInfo.rangeMax.toFixed(2)}</span>
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-sm font-semibold text-white">Show all maps</span>
        </label>
      </div>

      {showAll && outOfRangeCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Showing all {maps.length} maps ({outOfRangeCount} outside your rank). Maps outside your rank&apos;s rating
            range will <span className="font-semibold">not</span> earn you RHP.
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-background/50 p-10 text-center text-sm text-muted">
          No maps available in your rank&apos;s rating range yet. Submit one for review or check back soon!
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {visibleMaps.map((map) => {
            const message = messages[map.id];
            const lengthLabel = map.length != null
              ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}`
              : null;
            return (
              <article key={map.id} className="flex flex-col rounded-3xl border border-border bg-surface/95 p-5 shadow-glow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted">{map.artist ?? "Unknown artist"}</p>
                    <h3 className="mt-1 truncate text-xl font-semibold text-white">{map.title}</h3>
                    <p className="mt-1 text-xs text-muted">Mapped by {map.mapperName ?? map.submittedBy?.displayName ?? "Unknown"}</p>
                  </div>
                  {map.rating != null && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-sm font-semibold text-amber-300">
                      <Star className="h-3.5 w-3.5" fill="currentColor" /> {map.rating.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                  {map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}
                  {lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{lengthLabel}</span>}
                  <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">Rating: {map.rating != null ? map.rating.toFixed(2) : "—"}</span>
                </div>

                {map.completion?.passed ? (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                    <CheckCircle2 size={16} /> Completed · {map.completion.points} RHP
                  </div>
                ) : map.completion ? (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300">
                    <XCircle size={16} /> Attempted · {map.completion.points} RHP
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <a
                    href={map.mapFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"
                  >
                    <Download size={15} /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => void checkMap(map.id)}
                    disabled={busyId === map.id}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-60"
                  >
                    <RefreshCw size={15} className={busyId === map.id ? "animate-spin" : ""} />
                    {busyId === map.id ? "Checking..." : "Check my score"}
                  </button>
                </div>

                {message && (
                  <p className={`mt-3 rounded-2xl border p-3 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : message.tone === "warn" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>
                    {message.text}
                  </p>
                )}
              </article>
            );
          })}
          </div>
          {filtered.length > visibleMaps.length && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
                className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/20"
              >
                <ChevronDown size={16} /> Show more maps ({filtered.length - visibleMaps.length} remaining)
              </button>
            </div>
          )}
        </>
      )}

      <div className="flex justify-center pt-2">
        <Link href="/maps/submit" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2">
          <MapIcon size={16} /> Submit a map for review
        </Link>
      </div>
    </div>
  );
}