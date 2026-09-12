"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pause, Play, RotateCcw, Settings } from "lucide-react";
import {
  DEFAULT_RHYTHIAN_BROWSER_SETTINGS,
  RHYTHIAN_BROWSER_SETTINGS_KEY,
  sanitizeRhythianBrowserSettings,
  type RhythianBrowserSettings,
} from "@/lib/rhythian-browser-settings";

type Note = { time: number; x: number; y: number };
type ImportedMap = {
  localId: string;
  fileName: string;
  map: { id: string | null; title: string; artist: string | null; mapperName: string | null; isRanked: boolean; status: string };
  analysis: { rating: number; noteCount: number };
  notes: Note[];
};

type Result = { hit: boolean; delta: number; points: number };
const DB_NAME = "rhythians-client";
const STORE = "maps";

async function readMap(id: string) {
  return new Promise<ImportedMap | null>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "localId" }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(STORE, "readonly");
      const get = tx.objectStore(STORE).get(id);
      get.onsuccess = () => resolve((get.result as ImportedMap | undefined) ?? null);
      get.onerror = () => reject(get.error);
    };
  });
}

function loadSettings() {
  try { return sanitizeRhythianBrowserSettings(JSON.parse(localStorage.getItem(RHYTHIAN_BROWSER_SETTINGS_KEY) ?? "null")); }
  catch { return DEFAULT_RHYTHIAN_BROWSER_SETTINGS; }
}

function windowFor(settings: RhythianBrowserSettings) {
  if (settings.hardRock || settings.hardMode) return 70;
  if (settings.easyMode) return 145;
  return 105;
}

export function RhythianBrowserGame({ localId }: { localId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const startRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const judgedRef = useRef(new Map<number, Result>());
  const [map, setMap] = useState<ImportedMap | null>(null);
  const [settings, setSettings] = useState<RhythianBrowserSettings>(DEFAULT_RHYTHIAN_BROWSER_SETTINGS);
  const [state, setState] = useState<"loading" | "ready" | "playing" | "paused" | "finished" | "missing">("loading");
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [health, setHealth] = useState(100);

  useEffect(() => {
    setSettings(loadSettings());
    void readMap(localId).then((value) => { setMap(value); setState(value ? "ready" : "missing"); }).catch(() => setState("missing"));
    const update = (event: Event) => setSettings(sanitizeRhythianBrowserSettings((event as CustomEvent<Partial<RhythianBrowserSettings>>).detail));
    window.addEventListener("rhythian-browser-settings", update);
    return () => window.removeEventListener("rhythian-browser-settings", update);
  }, [localId]);

  const duration = useMemo(() => map?.notes.length ? map.notes[map.notes.length - 1].time + 1200 : 0, [map]);

  const reset = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    judgedRef.current.clear();
    setTime(0); setScore(0); setCombo(0); setMaxCombo(0); setHits(0); setMisses(0); setHealth(100);
    setState(map ? "ready" : "missing");
  }, [map]);

  const start = useCallback(() => {
    if (!map) return;
    if (state === "finished") { reset(); return; }
    const base = state === "paused" ? pausedAtRef.current : time;
    startRef.current = performance.now() - base / settings.speed;
    setState("playing");
  }, [map, reset, settings.speed, state, time]);

  const pause = useCallback(() => {
    pausedAtRef.current = time;
    setState("paused");
    cancelAnimationFrame(frameRef.current);
  }, [time]);

  useEffect(() => {
    if (!map || state !== "playing") return;
    const hitWindow = windowFor(settings);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const draw = (now: number) => {
      const songTime = Math.max(0, (now - startRef.current) * settings.speed + settings.globalOffsetMs);
      setTime(songTime);
      const width = canvas.width;
      const height = canvas.height;
      const quake = settings.earthquake ? Math.sin(songTime / 28) * 7 : 0;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(quake, settings.chaos ? Math.sin(songTime / 160) * 5 : 0);
      ctx.fillStyle = `rgba(5,8,15,${0.64 + settings.backgroundDim * 0.32})`;
      ctx.fillRect(-20, -20, width + 40, height + 40);
      ctx.strokeStyle = "rgba(255,255,255,.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += width / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y <= height; y += height / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      const approach = settings.nearsight ? Math.min(settings.approachMs, 500) : settings.approachMs;
      const pointer = pointerRef.current;
      map.notes.forEach((note, index) => {
        const delta = note.time - songTime;
        if (delta > approach || delta < -hitWindow - 40 || judgedRef.current.has(index)) return;
        let nx = Math.max(0, Math.min(1, note.x / 2));
        let ny = Math.max(0, Math.min(1, note.y / 2));
        if (settings.mirrorX) nx = 1 - nx;
        if (settings.mirrorY || settings.hardRock) ny = 1 - ny;
        const x = nx * width;
        const y = ny * height;
        const progress = Math.max(0, Math.min(1, 1 - delta / Math.max(1, approach)));
        const ghostAlpha = settings.ghost ? Math.max(0.12, 1 - progress * 0.78) : 1;
        const radius = 18 * settings.noteScale;
        ctx.globalAlpha = ghostAlpha;
        ctx.beginPath(); ctx.arc(x, y, radius + (1 - progress) * 34, 0, Math.PI * 2); ctx.strokeStyle = "rgba(139,92,246,.7)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, Math.max(3, radius * .28), 0, Math.PI * 2); ctx.fillStyle = "rgb(139,92,246)"; ctx.fill();
        ctx.globalAlpha = 1;

        if (Math.abs(delta) <= hitWindow) {
          const dx = pointer.x - nx;
          const dy = pointer.y - ny;
          const distance = Math.hypot(dx, dy);
          const threshold = 0.062 * settings.noteScale * (settings.easyMode ? 1.25 : settings.hardRock ? 0.82 : 1);
          if (distance <= threshold) {
            const precision = Math.max(0, 1 - Math.abs(delta) / hitWindow);
            const points = Math.round(700 + 300 * precision);
            judgedRef.current.set(index, { hit: true, delta, points });
            setScore((value) => value + points);
            setHits((value) => value + 1);
            setCombo((value) => { const next = value + 1; setMaxCombo((best) => Math.max(best, next)); return next; });
            setHealth((value) => Math.min(100, value + 1.5));
          }
        }
        if (delta < -hitWindow && !judgedRef.current.has(index)) {
          judgedRef.current.set(index, { hit: false, delta, points: 0 });
          setMisses((value) => value + 1);
          setCombo(0);
          setHealth((value) => Math.max(0, value - (settings.easyMode ? 5 : 10)));
          if (settings.suddenDeath) { setState("finished"); return; }
        }
      });

      if (settings.flashlight) {
        const px = pointer.x * width, py = pointer.y * height;
        const gradient = ctx.createRadialGradient(px, py, 80, px, py, 260);
        gradient.addColorStop(0, "rgba(0,0,0,0)"); gradient.addColorStop(1, "rgba(0,0,0,.96)");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();

      const px = pointer.x * width, py = pointer.y * height;
      ctx.beginPath(); ctx.arc(px, py, 8 * settings.cursorScale, 0, Math.PI * 2); ctx.fillStyle = "white"; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 3 * settings.cursorScale, 0, Math.PI * 2); ctx.fillStyle = "rgb(139,92,246)"; ctx.fill();

      if (songTime >= duration) { setState("finished"); return; }
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [duration, map, settings, state]);

  if (state === "loading") return <div className="ui-page text-muted">Loading local map…</div>;
  if (state === "missing" || !map) return <div className="ui-page max-w-2xl"><section className="ui-panel"><h1 className="text-2xl font-bold text-white">Map not found</h1><p className="mt-2 text-sm text-muted">Import the SSPM map from the Maps page on this browser first.</p><Link href="/maps" className="mt-5 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white">Back to maps</Link></section></div>;

  const accuracy = hits + misses ? hits / (hits + misses) * 100 : 100;
  return <div className="fixed inset-0 z-[80] flex flex-col bg-[#05080f] text-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><Link href="/maps" className="rounded-lg p-2 hover:bg-white/10"><ArrowLeft size={18} /></Link><div className="min-w-0"><p className="truncate font-bold">{map.map.title}</p><p className="truncate text-xs text-muted">{map.map.artist ?? map.fileName} · {map.analysis.rating.toFixed(2)} · {map.map.status}</p></div></div><div className="flex items-center gap-2"><Link href="/settings#client-gameplay" className="rounded-lg border border-white/10 p-2 hover:bg-white/10"><Settings size={17} /></Link><button type="button" onClick={reset} className="rounded-lg border border-white/10 p-2 hover:bg-white/10"><RotateCcw size={17} /></button>{state === "playing" ? <button type="button" onClick={pause} className="rounded-lg bg-accent p-2"><Pause size={17} /></button> : <button type="button" onClick={start} className="rounded-lg bg-accent p-2"><Play size={17} /></button>}</div></header>
    <div className="grid grid-cols-4 gap-px border-b border-white/10 bg-white/10 text-center text-xs"><div className="bg-[#080d18] px-2 py-2"><span className="text-muted">Score</span><strong className="ml-2">{score.toLocaleString()}</strong></div><div className="bg-[#080d18] px-2 py-2"><span className="text-muted">Combo</span><strong className="ml-2">{combo}x</strong></div><div className="bg-[#080d18] px-2 py-2"><span className="text-muted">Accuracy</span><strong className="ml-2">{accuracy.toFixed(2)}%</strong></div><div className="bg-[#080d18] px-2 py-2"><span className="text-muted">HP</span><strong className="ml-2">{health.toFixed(0)}</strong></div></div>
    <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3"><canvas ref={canvasRef} width={1280} height={720} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); let x = (event.clientX - rect.left) / rect.width; let y = (event.clientY - rect.top) / rect.height; if (settings.invertMouse) { x = 1 - x; y = 1 - y; } pointerRef.current = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }; }} className="max-h-full w-full max-w-[1280px] cursor-none rounded-xl border border-white/10 bg-black shadow-2xl" />{state === "ready" && <button type="button" onClick={start} className="absolute rounded-full bg-accent px-8 py-4 text-lg font-black shadow-glow">Play</button>}{state === "paused" && <button type="button" onClick={start} className="absolute rounded-full bg-accent px-8 py-4 text-lg font-black shadow-glow">Resume</button>}{state === "finished" && <div className="absolute w-[min(92%,520px)] rounded-3xl border border-white/10 bg-[#0b1120]/95 p-7 text-center shadow-2xl"><p className="text-xs font-black uppercase tracking-[.18em] text-accent">Results</p><h2 className="mt-2 text-3xl font-black">{score.toLocaleString()}</h2><div className="mt-5 grid grid-cols-3 gap-3 text-sm"><div className="rounded-xl bg-white/5 p-3"><p className="text-muted">Accuracy</p><p className="mt-1 font-bold">{accuracy.toFixed(2)}%</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-muted">Max combo</p><p className="mt-1 font-bold">{maxCombo}x</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-muted">Misses</p><p className="mt-1 font-bold">{misses}</p></div></div><p className="mt-4 text-xs leading-5 text-muted">Local/imported runs are practice-only. Ranked Rhythians rewards remain tied to verified Rhythia score data.</p><div className="mt-5 flex justify-center gap-2"><button type="button" onClick={reset} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold">Retry</button><Link href="/maps" className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold">Maps</Link></div></div>}</main>
    <footer className="h-1 bg-white/5"><div className="h-full bg-accent" style={{ width: `${Math.min(100, duration ? time / duration * 100 : 0)}%` }} /></footer>
  </div>;
}
