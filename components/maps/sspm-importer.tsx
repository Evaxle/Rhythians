"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Play, Trash2, Upload } from "lucide-react";

type ImportedMap = {
  localId: string;
  fileName: string;
  importedAt: number;
  map: { id: string | null; title: string; artist: string | null; mapperName: string | null; imageUrl: string | null; isRanked: boolean; isLegacy: boolean; status: string; officialRating: number | null };
  analysis: { rating: number; noteCount: number; activeDurationMs: number };
  notes: Array<{ time: number; x: number; y: number }>;
};

const DB_NAME = "rhythians-client";
const STORE = "maps";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "localId" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readMaps() {
  const db = await openDb();
  return new Promise<ImportedMap[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as ImportedMap[]).sort((a, b) => b.importedAt - a.importedAt));
    request.onerror = () => reject(request.error);
  });
}

async function putMap(map: ImportedMap) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(map);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeMap(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function SspmImporter() {
  const input = useRef<HTMLInputElement>(null);
  const [maps, setMaps] = useState<ImportedMap[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void readMaps().then(setMaps).catch(() => setMessage("Local map storage is unavailable in this browser.")); }, []);

  async function importMap(file: File) {
    setBusy(true);
    setMessage("Analyzing map…");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/maps/import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to import map.");
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const localId = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const imported: ImportedMap = { localId, fileName: file.name, importedAt: Date.now(), map: data.map, analysis: data.analysis, notes: data.notes };
      await putMap(imported);
      setMaps(await readMaps());
      setMessage(`${data.map.title} analyzed at ${Number(data.analysis.rating).toFixed(2)} · ${data.map.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import map.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.055] to-black/20 p-5 shadow-glow">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Local content</p><h2 className="mt-1 text-xl font-bold text-white">Import SSPM map</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Import an SSPM v2 map into your browser library. Rhythians analyzes the same note data used by the ranking system. Maps not found in the Rhythians catalog stay Unranked but still receive their analyzed difficulty rating.</p></div><div><input ref={input} type="file" accept=".sspm,application/octet-stream" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importMap(file); }} /><button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Upload size={16} /> {busy ? "Analyzing…" : "Import SSPM"}</button></div></div>
    {message && <p className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.06] p-3 text-sm text-accent">{message}</p>}
    {maps.length > 0 && <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{maps.map((item) => <article key={item.localId} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs text-muted">{item.map.artist ?? item.fileName}</p><h3 className="mt-1 truncate font-bold text-white">{item.map.title}</h3><p className="mt-1 text-xs text-muted">{item.analysis.noteCount.toLocaleString()} notes · {(item.analysis.activeDurationMs / 1000).toFixed(1)}s</p></div><div className="text-right"><p className="text-lg font-black text-white">{item.analysis.rating.toFixed(2)}</p><p className={`text-xs font-bold ${item.map.isRanked ? "text-emerald-300" : item.map.isLegacy ? "text-sky-300" : "text-amber-300"}`}>{item.map.status}</p></div></div><div className="mt-4 flex gap-2"><Link href={`/play?local=${item.localId}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white"><Play size={14} /> Play</Link>{item.map.id && <Link href={`/maps/${item.map.id}`} className="inline-flex items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-white" title="Open Rhythians map"><Download size={14} /></Link>}<button type="button" onClick={() => void removeMap(item.localId).then(() => readMaps().then(setMaps))} className="inline-flex items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-muted hover:text-white" title="Remove local map"><Trash2 size={14} /></button></div></article>)}</div>}
  </section>;
}
