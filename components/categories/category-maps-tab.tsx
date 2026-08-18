"use client";

import { useState } from "react";
import { CheckCircle2, Download, FolderDown, Lock, RefreshCw } from "lucide-react";
import { CATEGORY_LABELS, MAX_CATEGORY_LEVEL, type Category } from "@/lib/category-constants";
import { CategoryPills } from "@/components/categories/category-pills";

type MapEntry = {
  id: string;
  category: Category;
  level: number;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  completion: { passed: boolean; accuracy: number | null } | null;
};

export function CategoryMapsTab({
  category,
  onCategoryChange,
  level,
  maps,
}: {
  category: Category;
  onCategoryChange: (category: Category) => void;
  level: number;
  maps: MapEntry[];
}) {
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, { tone: "ok" | "warn" | "err"; text: string }>>({});

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: { tone: "ok", text: "Checking your scores..." } }));
    try {
      const response = await fetch("/api/categories/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryMapId: id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessages((current) => ({ ...current, [id]: { tone: "err", text: data.error ?? "Unable to check your scores." } }));
        return;
      }
      if (data.status === "level_up") {
        setMessages((current) => ({ ...current, [id]: { tone: "ok", text: `Level up! You reached ${CATEGORY_LABELS[category]} level ${data.level}.` } }));
      } else if (data.status === "passed") {
        setMessages((current) => ({ ...current, [id]: { tone: "ok", text: "Map completed (no level change)." } }));
      } else if (data.status === "already") {
        setMessages((current) => ({ ...current, [id]: { tone: "ok", text: "You already completed this map." } }));
      } else if (data.status === "locked") {
        setMessages((current) => ({ ...current, [id]: { tone: "warn", text: `Locked — you must pass a level ${data.requiredLevel} map first.` } }));
      } else if (data.status === "not_beat") {
        setMessages((current) => ({ ...current, [id]: { tone: "warn", text: "No passing score found for this map yet. Beat it in Rhythia and check again." } }));
      } else {
        setMessages((current) => ({ ...current, [id]: { tone: "warn", text: "This map isn't available right now." } }));
      }
    } catch {
      setMessages((current) => ({ ...current, [id]: { tone: "err", text: "Unable to reach the server. Try again." } }));
    } finally {
      setBusyId("");
    }
  }

  const nextLevel = Math.min(MAX_CATEGORY_LEVEL, level + 1);
  const levels = Array.from({ length: MAX_CATEGORY_LEVEL }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            Category: <span className="font-semibold text-white">{CATEGORY_LABELS[category]}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            Your level: <span className="font-semibold text-accent">{level}</span>
            {level < MAX_CATEGORY_LEVEL && (
              <span className="ml-2 text-xs text-muted">
                Pass one level {nextLevel} map to reach level {nextLevel}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <CategoryPills selected={category} onSelect={onCategoryChange} />
          <a
            href={`/api/categories/download?category=${encodeURIComponent(category)}`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"
          >
            <FolderDown size={15} /> Download all levels
          </a>
        </div>
      </div>

      {level >= MAX_CATEGORY_LEVEL && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
          You&apos;ve reached the max level ({MAX_CATEGORY_LEVEL}) in {CATEGORY_LABELS[category]}. You can still beat maps
          for completion credit.
        </div>
      )}

      {levels.map((mapLevel) => {
        const levelMaps = maps.filter((map) => map.level === mapLevel);
        const isNext = mapLevel === nextLevel;
        const isLocked = mapLevel > nextLevel;
        const isDone = mapLevel <= level;
        return (
          <section key={mapLevel} className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                    isDone ? "bg-emerald-400/15 text-emerald-300" : isNext ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"
                  }`}
                >
                  {mapLevel}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Level {mapLevel}</p>
                  <p className="text-xs text-muted">
                    {isDone ? "Completed" : isNext ? "Your next level" : "Locked — complete earlier levels first"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{levelMaps.length} map{levelMaps.length === 1 ? "" : "s"}</span>
                {levelMaps.length > 0 && (
                  <a
                    href={`/api/categories/download?category=${encodeURIComponent(category)}&level=${mapLevel}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent/20"
                  >
                    <Download size={13} /> Download level
                  </a>
                )}
              </div>
            </div>

            {levelMaps.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border bg-background/50 p-4 text-sm text-muted">
                No maps in this level yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {levelMaps.map((map) => {
                  const message = messages[map.id];
                  const lengthLabel = map.length != null
                    ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}`
                    : null;
                  return (
                    <article key={map.id} className="flex flex-col rounded-2xl border border-border bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted">{map.artist ?? "Unknown artist"}</p>
                          <h3 className="mt-1 truncate text-base font-semibold text-white">{map.title}</h3>
                          <p className="mt-1 text-xs text-muted">Mapped by {map.mapperName ?? "Unknown"}</p>
                        </div>
                        {map.completion?.passed ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                            <CheckCircle2 size={13} /> Done
                          </span>
                        ) : isLocked ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted">
                            <Lock size={13} /> Locked
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                        {map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}
                        {lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{lengthLabel}</span>}
                      </div>

                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
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
                          disabled={busyId === map.id || isLocked}
                          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
                        >
                          <RefreshCw size={15} className={busyId === map.id ? "animate-spin" : ""} />
                          {busyId === map.id ? "Checking..." : "Check my score"}
                        </button>
                      </div>

                      {message && (
                        <p className={`mt-3 rounded-xl border p-3 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : message.tone === "warn" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>
                          {message.text}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
