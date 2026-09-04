"use client";

import { useState } from "react";
import { CheckCircle2, Download, Lock, RefreshCw, Video, Sparkles, ChevronRight } from "lucide-react";

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
  const [selectedLevel, setSelectedLevel] = useState(Math.min(nextLevel, MAX_LEVEL));

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

  const levelMaps = maps.filter((map) => map.level === selectedLevel);
  const selectedIsLocked = selectedLevel > nextLevel;
  const selectedIsDone = selectedLevel <= level;
  const canSubmitClip = selectedLevel >= 7 && selectedLevel <= 10;
  const clipAvailable = selectedLevel === level + 1 && canSubmitClip;

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[2rem] border border-accent/15 bg-[radial-gradient(circle_at_12%_0%,rgba(124,143,240,0.16),transparent_30%),radial-gradient(circle_at_90%_100%,rgba(85,214,160,0.08),transparent_26%),linear-gradient(145deg,rgba(20,27,45,0.94),rgba(10,14,25,0.97))] p-5 shadow-glow sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="ui-kicker text-accent">Challenge progression</p><h2 className="mt-2 text-3xl font-semibold text-white">Level {level}<span className="text-muted"> / {MAX_LEVEL}</span></h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Complete the next level to unlock more maps. Pick a level below instead of scrolling through the entire challenge path.</p></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-3"><p className="ui-kicker text-emerald-300">Next objective</p><p className="mt-1 text-sm font-semibold text-white">{level >= MAX_LEVEL ? "Maximum level reached" : `Pass a Level ${nextLevel} map`}</p></div></div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400 transition-all" style={{ width: `${Math.max(4, (level / MAX_LEVEL) * 100)}%` }} /></div>
    </section>

    <section className="ui-card rounded-[2rem] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="ui-kicker text-muted">Level map</p><p className="mt-1 text-sm text-muted">Select a level to view its maps.</p></div><Sparkles className="text-accent" size={18} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">{Array.from({ length: MAX_LEVEL }, (_, index) => index + 1).map((mapLevel) => { const done = mapLevel <= level; const isNext = mapLevel === nextLevel; const locked = mapLevel > nextLevel; const active = mapLevel === selectedLevel; const count = maps.filter((map) => map.level === mapLevel).length; return <button key={mapLevel} type="button" disabled={locked} onClick={() => setSelectedLevel(mapLevel)} className={`relative rounded-2xl border p-3 text-left transition duration-200 ${active ? "border-accent/60 bg-accent/10 shadow-lg shadow-accent/10" : done ? "border-emerald-400/25 bg-emerald-400/[0.06]" : isNext ? "border-accent/30 bg-accent/[0.05]" : "border-white/10 bg-white/[0.025]"} ${locked ? "cursor-not-allowed opacity-45" : "hover:-translate-y-0.5 hover:border-white/20"}`}><div className="flex items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${done ? "bg-emerald-400/15 text-emerald-300" : isNext ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"}`}>{done ? <CheckCircle2 size={14} /> : locked ? <Lock size={13} /> : mapLevel}</span>{active && <ChevronRight size={14} className="text-accent" />}</div><p className="mt-2 text-xs font-semibold text-white">Level {mapLevel}</p><p className="mt-0.5 text-[10px] text-muted">{count} map{count === 1 ? "" : "s"}</p></button>; })}</div>
    </section>

    <section className="ui-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="ui-kicker text-accent">Level {selectedLevel}</p><h3 className="mt-1 text-2xl font-semibold text-white">{selectedIsDone ? "Completed maps" : selectedIsLocked ? "Locked maps" : "Current maps"}</h3><p className="mt-1 text-sm text-muted">{levelMaps.length} map{levelMaps.length === 1 ? "" : "s"} available in this level.</p></div><div className="flex flex-wrap items-center gap-2">{selectedIsDone && <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">Completed</span>}{selectedIsLocked && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted"><Lock className="mr-1 inline" size={12} /> Locked</span>}{canSubmitClip && (clipAvailable ? <a href={`/completion?kind=challenge&level=${selectedLevel}`} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent2"><Video className="mr-1 inline" size={13} /> Upload clip</a> : <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted"><Video className="mr-1 inline" size={13} /> Upload clip</span>)}</div></div>
      {levelMaps.length === 0 ? <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-black/10 p-12 text-center text-sm text-muted">No maps in this level yet.</div> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{levelMaps.map((map) => { const message = messages[map.id]; const lengthLabel = map.length != null ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}` : null; return <article key={map.id} className={`group rounded-3xl border p-4 transition duration-200 ${selectedIsLocked ? "border-white/10 bg-black/10 opacity-55 grayscale" : "border-white/10 bg-background/45 hover:-translate-y-0.5 hover:border-accent/20"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted">{map.artist ?? "Unknown artist"}</p><h4 className="mt-1 truncate text-base font-semibold text-white">{map.title}</h4><p className="mt-1 text-xs text-muted">{map.rating.toFixed(2)} rating · mapped by {map.mapperName ?? "Unknown"}</p></div>{map.completion?.passed ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"><CheckCircle2 size={13} /> Done</span> : selectedIsLocked ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted"><Lock size={13} /> Locked</span> : null}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">{map.noteCount != null && <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}{lengthLabel && <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">{lengthLabel}</span>}</div><div className="mt-4 flex flex-wrap gap-2"><a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-white hover:bg-accent/20"><Download size={14} /> Download</a><button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id || selectedIsLocked} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent2 disabled:opacity-45"><RefreshCw size={14} className={busyId === map.id ? "animate-spin" : ""} />{busyId === map.id ? "Checking..." : "Check score"}</button></div>{message && <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-muted">{message}</p>}</article>; })}</div>}
    </section>
  </div>;
}
