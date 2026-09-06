"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Download, Lock, RefreshCw, Video, Sparkles, ChevronRight, GalleryHorizontalEnd } from "lucide-react";

const MAX_LEVEL = 10;

type MapEntry = { id: string; level: number; title: string; artist: string | null; mapFileUrl: string; mapperName: string | null; noteCount: number | null; length: number | null; rating: number; completion: { passed: boolean; accuracy: number | null } | null };

export function ChallengeBrowser({ maps, level }: { maps: MapEntry[]; level: number }) {
  const [busyId, setBusyId] = useState("");
  const [busyLevel, setBusyLevel] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const nextLevel = Math.min(MAX_LEVEL, level + 1);
  const [selectedLevel, setSelectedLevel] = useState(Math.min(nextLevel, MAX_LEVEL));

  async function checkMap(id: string) {
    setBusyId(id);
    setMessages((current) => ({ ...current, [id]: "Checking your Rhythia score..." }));
    try {
      const response = await fetch("/api/challenge/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeMapId: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your score.");
      const text = data.status === "level_up" ? `Level up! You reached Challenge Level ${data.level}.` : data.status === "already" ? "You already completed this map." : data.status === "passed" ? "Map completed." : data.status === "locked" ? `Locked — pass a Level ${data.requiredLevel} map first.` : "No passing score found yet.";
      setMessages((current) => ({ ...current, [id]: text }));
    } catch (error) {
      setMessages((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Unable to reach the server." }));
    } finally { setBusyId(""); }
  }

  async function checkLevel() {
    setBusyLevel(selectedLevel);
    setMessages((current) => ({ ...current, level: `Checking every visible Level ${selectedLevel} map...` }));
    try {
      const response = await fetch("/api/challenge/check-level", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: selectedLevel }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check this level.");
      setMessages((current) => ({ ...current, level: `Checked ${data.checked} maps · ${data.passed} new pass${data.passed === 1 ? "" : "es"} · ${data.already} already complete.` }));
    } catch (error) {
      setMessages((current) => ({ ...current, level: error instanceof Error ? error.message : "Unable to check this level." }));
    } finally { setBusyLevel(null); }
  }

  const levelMaps = maps.filter((map) => map.level === selectedLevel);
  const selectedIsLocked = selectedLevel > nextLevel;
  const selectedIsDone = selectedLevel <= level;
  const proofLevel = selectedLevel >= 7;

  return <div className="space-y-5">
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="ui-card relative overflow-hidden rounded-[2rem] p-5 sm:p-6"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="ui-kicker text-accent">Challenge progression</p><h2 className="mt-2 text-3xl font-semibold text-white">Level {level}<span className="text-muted"> / {MAX_LEVEL}</span></h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Levels 1-6 use Rhythia score checks. Levels 7-10 use reviewed completion clips.</p></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-3"><p className="ui-kicker text-emerald-300">Next objective</p><p className="mt-1 text-sm font-semibold text-white">{level >= MAX_LEVEL ? "Maximum level reached" : `Complete Level ${nextLevel}`}</p></div></div><div className="relative mt-5 h-2 overflow-hidden rounded-full bg-black/30"><motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400" initial={{ width: 0 }} animate={{ width: `${Math.max(4, (level / MAX_LEVEL) * 100)}%` }} transition={{ duration: .7, ease: [0.16,1,0.3,1] }} /></div></motion.section>
    <section className="ui-card rounded-[2rem] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="ui-kicker text-muted">Level map</p><p className="mt-1 text-sm text-muted">Choose any unlocked level.</p></div><Sparkles className="text-accent" size={18} /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">{Array.from({ length: MAX_LEVEL }, (_, index) => index + 1).map((mapLevel) => { const done = mapLevel <= level; const isNext = mapLevel === nextLevel; const locked = mapLevel > nextLevel; const active = mapLevel === selectedLevel; const count = maps.filter((map) => map.level === mapLevel).length; return <motion.button whileHover={locked ? undefined : { y: -3 }} whileTap={locked ? undefined : { scale: .97 }} key={mapLevel} type="button" disabled={locked} onClick={() => setSelectedLevel(mapLevel)} className={`relative rounded-2xl border p-3 text-left ${active ? "border-accent/60 bg-accent/10 shadow-lg shadow-accent/10" : done ? "border-emerald-400/25 bg-emerald-400/[0.06]" : isNext ? "border-accent/30 bg-accent/[0.05]" : "border-white/10 bg-white/[0.025]"} ${locked ? "cursor-not-allowed opacity-45" : ""}`}><div className="flex items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${done ? "bg-emerald-400/15 text-emerald-300" : isNext ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"}`}>{done ? <CheckCircle2 size={14} /> : locked ? <Lock size={13} /> : mapLevel}</span>{active && <ChevronRight size={14} className="text-accent" />}</div><p className="mt-2 text-xs font-semibold text-white">Level {mapLevel}</p><p className="mt-0.5 text-[10px] text-muted">{count} map{count === 1 ? "" : "s"}</p></motion.button>; })}</div></section>
    <section className="ui-card rounded-[2rem] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="ui-kicker text-accent">Level {selectedLevel}</p><h3 className="mt-1 text-2xl font-semibold text-white">{selectedIsDone ? "Completed maps" : selectedIsLocked ? "Locked maps" : "Current maps"}</h3><p className="mt-1 text-sm text-muted">{levelMaps.length} visible map{levelMaps.length === 1 ? "" : "s"}.</p></div><div className="flex flex-wrap items-center gap-2">{!proofLevel && !selectedIsLocked && <button type="button" onClick={() => void checkLevel()} disabled={busyLevel === selectedLevel} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw size={13} className={busyLevel === selectedLevel ? "animate-spin" : ""} /> {busyLevel === selectedLevel ? "Checking level..." : "Check all level"}</button>}{proofLevel && <a href={`/challenge/clips?kind=challenge&level=${selectedLevel}`} className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-white"><GalleryHorizontalEnd size={13} /> View clips</a>}{proofLevel && !selectedIsLocked && selectedLevel === level + 1 && <a href={`/completion?kind=challenge&level=${selectedLevel}`} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white"><Video size={13} /> Upload clip</a>}</div></div>{messages.level && <p className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-3 text-xs text-muted">{messages.level}</p>}
      {levelMaps.length === 0 ? <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-black/10 p-12 text-center text-sm text-muted">No visible maps in this level yet.</div> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{levelMaps.map((map, index) => { const message = messages[map.id]; const lengthLabel = map.length != null ? `${Math.floor(map.length / 60000)}:${String(Math.round((map.length % 60000) / 1000)).padStart(2, "0")}` : null; return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .035, .2) }} key={map.id} className={`rounded-3xl border p-4 ${selectedIsLocked ? "border-white/10 bg-black/10 opacity-55 grayscale" : "border-white/10 bg-background/45 hover:border-accent/20"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted">{map.artist ?? "Unknown artist"}</p><h4 className="mt-1 truncate text-base font-semibold text-white">{map.title}</h4><p className="mt-1 text-xs text-muted">{map.rating.toFixed(2)} rating · mapped by {map.mapperName ?? "Unknown"}</p></div>{map.completion?.passed && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"><CheckCircle2 size={13} /> Done</span>}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">{map.noteCount != null && <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}{lengthLabel && <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">{lengthLabel}</span>}</div><div className="mt-4 flex flex-wrap gap-2"><a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-white"><Download size={14} /> Download</a>{!proofLevel && <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id || selectedIsLocked} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-45"><RefreshCw size={14} className={busyId === map.id ? "animate-spin" : ""} />{busyId === map.id ? "Checking..." : "Check score"}</button>}</div>{message && <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-muted">{message}</p>}</motion.article>; })}</div>}
    </section>
  </div>;
}
