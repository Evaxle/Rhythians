"use client";

import { useState } from "react";
import { CheckCircle2, Download, Lock, RefreshCw, Video } from "lucide-react";

const MAX_LEVEL = 10;

type MapEntry = {
  id: string;
  level: number;
  title: string;
  artist: string | null;
  mapFileUrl: string;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  rating: number;
  completion: { passed: boolean; accuracy: number | null } | null;
};

export function ChallengeBrowser({ maps, level }: { maps: MapEntry[]; level: number }) {
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const nextLevel = Math.min(MAX_LEVEL, level + 1);

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: "Checking your Rhythia score..." }));
    try {
      const response = await fetch("/api/challenge/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeMapId: id }) });
      const data = await response.json();
      if (!response.ok) setMessages((current) => ({ ...current, [id]: data.error ?? "Unable to check your score." }));
      else if (data.status === "level_up") setMessages((current) => ({ ...current, [id]: `Level up! You reached Challenge Level ${data.level}.` }));
      else if (data.status === "locked") setMessages((current) => ({ ...current, [id]: `Locked — pass a Level ${data.requiredLevel} map first.` }));
      else if (data.status === "already") setMessages((current) => ({ ...current, [id]: "You already completed this map." }));
      else if (data.status === "passed") setMessages((current) => ({ ...current, [id]: data.points > 0 ? `Map completed. +${data.points} RHP.` : "Map completed. It is outside your current RHP rank range." }));
      else setMessages((current) => ({ ...current, [id]: "No passing score found. Beat the map in Rhythia and check again." }));
    } catch {
      setMessages((current) => ({ ...current, [id]: "Unable to reach the server. Try again." }));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm text-muted">Your Challenge Level</p><p className="mt-1 text-3xl font-semibold text-white">Level {level}</p>{level < MAX_LEVEL && <p className="mt-1 text-xs text-muted">Pass one Level {nextLevel} map to reach Level {nextLevel}.</p>}</div>
          {level >= MAX_LEVEL && <p className="text-sm font-semibold text-emerald-300">Maximum challenge level reached.</p>}
        </div>
      </section>

      {Array.from({ length: MAX_LEVEL }, (_, index) => index + 1).map((mapLevel) => {
        const levelMaps = maps.filter((map) => map.level === mapLevel);
        const isNext = mapLevel === nextLevel;
        const isLocked = mapLevel > nextLevel;
        const isDone = mapLevel <= level;
        const canSubmitClip = mapLevel >= 7 && mapLevel <= 10;
        const clipAvailable = mapLevel === level + 1 && canSubmitClip;
        return (
          <section key={mapLevel} className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${isDone ? "bg-emerald-400/15 text-emerald-300" : isNext ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"}`}>{mapLevel}</span><div><p className="text-sm font-semibold text-white">Challenge Level {mapLevel}</p><p className="text-xs text-muted">{isDone ? "Completed" : isNext ? "Your next level" : "Locked — complete earlier levels first"}</p></div></div>
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted">{levelMaps.length} map{levelMaps.length === 1 ? "" : "s"}</span>{canSubmitClip && (clipAvailable ? <a href={`/completion?kind=challenge&level=${mapLevel}`} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent2"><Video size={13} /> Submit clip</a> : <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted"><Video size={13} /> Submit clip</span>)}</div>
            </div>
            {levelMaps.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border bg-background/50 p-4 text-sm text-muted">No maps in this level yet.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{levelMaps.map((map) => {
              const message = messages[map.id];
              const lengthLabel = map.length != null ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}` : null;
              return <article key={map.id} className="flex flex-col rounded-2xl border border-border bg-background/60 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted">{map.artist ?? "Unknown artist"}</p><h3 className="mt-1 truncate text-base font-semibold text-white">{map.title}</h3><p className="mt-1 text-xs text-muted">{map.rating.toFixed(2)} rating · mapped by {map.mapperName ?? "Unknown"}</p></div>{map.completion?.passed ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"><CheckCircle2 size={13} /> Done</span> : isLocked ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted"><Lock size={13} /> Locked</span> : null}</div><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">{map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}{lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{lengthLabel}</span>}</div><div className="mt-auto flex flex-wrap gap-2 pt-4"><a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"><Download size={15} /> Download</a><button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id || isLocked} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"><RefreshCw size={15} className={busyId === map.id ? "animate-spin" : ""} />{busyId === map.id ? "Checking..." : "Check my score"}</button></div>{message && <p className="mt-3 rounded-xl border border-border bg-background/70 p-3 text-sm text-muted">{message}</p>}</article>;
            })}</div>}
          </section>
        );
      })}
    </div>
  );
}
