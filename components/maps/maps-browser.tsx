"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Map as MapIcon, RefreshCw, Search, XCircle } from "lucide-react";
import type { RankInfo } from "@/lib/ranks";
import { RANKS, isMapInRankRange, rhpGainForMap } from "@/lib/ranks";

const PAGE_SIZE = 40;

type MapEntry = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  rating: number | null;
  rankIndex: number;
  rankName: string;
  rankColor: string;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  completion: { passed: boolean; points: number } | null;
  hasScore: boolean;
  submittedBy: { displayName: string | null; username: string; profileHandle: string } | null;
  reviewedBy: { displayName: string | null; username: string; profileHandle: string } | null;
};

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    let value = (crc ^ byte) & 0xff;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    crc = (crc >>> 8) ^ value;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, value & 0xffff, true);
  return new Uint8Array(buffer);
}

function u32(value: number) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value >>> 0, true);
  return new Uint8Array(buffer);
}

function join(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function buildZip(files: Array<{ name: string; data: Uint8Array }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const size = file.data.length;
    const checksum = crc32(file.data);
    const local = join([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(checksum), u32(size), u32(size), u16(name.length), u16(0), name, file.data,
    ]);
    const central = join([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(checksum), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), name,
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  }

  const local = join(localParts);
  const central = join(centralParts);
  const end = join([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(local.length), u16(0),
  ]);
  return join([local, central, end]);
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "map";
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/(\.[a-z0-9]{2,8})$/i);
    return match?.[1] ?? ".sspm";
  } catch {
    return ".sspm";
  }
}

export function MapsBrowser({ maps, rankInfo, userRhp, currentUserId }: { maps: MapEntry[]; rankInfo: RankInfo; userRhp: number; currentUserId: string | null }) {
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState("");
  const [messages, setMessages] = useState<Record<string, { tone: "ok" | "warn" | "err"; text: string }>>({});
  const [query, setQuery] = useState("");
  const [autoChecking, setAutoChecking] = useState(false);
  const [didAutoCheck, setDidAutoCheck] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const filtered = useMemo(() => {
    let list = showAll ? maps : maps.filter((map) => map.rating != null && isMapInRankRange(map.rating, rankInfo.index));
    const term = query.trim().toLowerCase();
    if (term) list = list.filter((map) => map.title.toLowerCase().includes(term) || map.artist?.toLowerCase().includes(term) || map.mapperName?.toLowerCase().includes(term));
    return list;
  }, [maps, showAll, rankInfo.index, query]);

  const visibleMaps = filtered.slice(0, visibleCount);
  const outOfRangeCount = maps.length - filtered.length;
  const rankMaps = maps.filter((map) => map.rating != null && isMapInRankRange(map.rating, rankInfo.index) && map.mapFileUrl);

  useEffect(() => {
    if (didAutoCheck || maps.length === 0) return;
    const toCheck = maps.filter((map) => map.rating != null && isMapInRankRange(map.rating, rankInfo.index) && !map.completion && !map.hasScore);
    if (toCheck.length === 0) return;
    let index = 0;
    async function run() {
      setAutoChecking(true);
      setDidAutoCheck(true);
      while (index < toCheck.length) {
        await checkMap(toCheck[index].id, true);
        index += 1;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      setAutoChecking(false);
    }
    void run();
  }, [maps, didAutoCheck, rankInfo.index]);

  async function checkMap(id: string, isAuto = false) {
    setBusyId(id);
    if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone: "ok", text: "Checking your scores..." } }));
    try {
      const response = await fetch("/api/maps/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapId: id }) });
      const data = await response.json();
      if (!response.ok) {
        if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone: "err", text: data.error ?? "Unable to check your scores." } }));
        return;
      }
      const text = data.status === "beat"
        ? `You earned ${data.points} RHP!${data.accuracy != null ? ` (${data.accuracy.toFixed(2)}% accuracy)` : ""}`
        : data.status === "already"
          ? "You already earned RHP for this map."
          : data.status === "failed"
            ? `Attempt recorded. You lost ${Math.abs(data.points)} RHP.`
            : data.status === "out_of_range"
              ? "This map is outside your rank's rating range."
              : "No score found for this map yet.";
      const tone = data.status === "beat" || data.status === "already" ? "ok" : data.status === "failed" ? "warn" : "warn";
      if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone, text } }));
    } catch {
      if (!isAuto) setMessages((current) => ({ ...current, [id]: { tone: "err", text: "Unable to reach the server. Try again." } }));
    } finally {
      setBusyId("");
    }
  }

  async function downloadRankMaps() {
    setDownloading(true);
    setMessages((current) => ({ ...current, __download: { tone: "ok", text: `Downloading 0/${rankMaps.length} maps...` } }));
    try {
      const files: Array<{ name: string; data: Uint8Array }> = [];
      const failures: string[] = [];
      const queue = [...rankMaps];
      let completed = 0;
      const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
        while (queue.length) {
          const map = queue.shift();
          if (!map) return;
          try {
            const response = await fetch(map.mapFileUrl, { mode: "cors", cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = new Uint8Array(await response.arrayBuffer());
            completed += 1;
            files.push({ name: `${String(completed).padStart(3, "0")} - ${safeName(map.title)}${extensionFromUrl(map.mapFileUrl)}`, data });
            setMessages((current) => ({ ...current, __download: { tone: "ok", text: `Downloading ${completed}/${rankMaps.length} maps...` } }));
          } catch (error) {
            failures.push(`${map.title}: ${error instanceof Error ? error.message : "download failed"}`);
          }
        }
      });
      await Promise.all(workers);

      if (!files.length) throw new Error("Your browser could not fetch the Rhythia map files. Try the individual Download buttons to confirm static.rhythia.com is reachable.");
      if (failures.length) files.push({ name: "download-errors.txt", data: new TextEncoder().encode(`${failures.join("\n")}\n`) });

      const zip = buildZip(files);
      const blob = new Blob([zip], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${rankInfo.isExpert ? "Expert" : rankInfo.name}-maps.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessages((current) => ({ ...current, __download: { tone: failures.length ? "warn" : "ok", text: `Created ZIP with ${rankMaps.length - failures.length} maps${failures.length ? ` · ${failures.length} failed` : ""}.` } }));
    } catch (error) {
      setMessages((current) => ({ ...current, __download: { tone: "err", text: error instanceof Error ? error.message : "Unable to create the rank maps ZIP." } }));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">Your rank: <span className="font-semibold" style={{ color: rankInfo.color }}>{rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`}</span> · {userRhp.toLocaleString()} RHP</p>
          <p className="mt-1 text-xs text-muted">Allowed rating range: <span className="font-semibold text-white">{rankInfo.rangeMin.toFixed(2)} – {rankInfo.rangeMax.toFixed(2)}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void downloadRankMaps()} disabled={downloading || rankMaps.length === 0} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/20 disabled:opacity-50">
            <Download size={15} /> {downloading ? "Building ZIP..." : `Download ${rankMaps.length} rank maps`}
          </button>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
            <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} className="h-4 w-4 accent-accent" />
            <span className="text-sm font-semibold text-white">Show all maps</span>
          </label>
        </div>
      </div>

      {messages.__download && <p className={`rounded-2xl border p-3 text-sm ${messages.__download.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : messages.__download.tone === "warn" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>{messages.__download.text}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search maps by title, artist, or mapper..." className="w-full rounded-full border border-border bg-surface/95 py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none" />
        </div>
        {autoChecking && <span className="inline-flex items-center gap-2 text-xs text-muted"><RefreshCw size={13} className="animate-spin" /> Checking scores in your rank...</span>}
      </div>

      {showAll && outOfRangeCount > 0 && <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Showing all {maps.length} maps ({outOfRangeCount} outside your rank). Maps outside your rank&apos;s rating range will <span className="font-semibold">not</span> earn you RHP.</p></div>}

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-background/50 p-10 text-center text-sm text-muted">{query.trim() ? `No maps match "${query.trim()}". Try a different search.` : "No maps available in your rank's rating range yet. Submit one for review or check back soon!"}</div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {visibleMaps.map((map) => {
              const message = messages[map.id];
              const rank = RANKS[map.rankIndex] ?? RANKS[RANKS.length - 1];
              const scored = map.hasScore || Boolean(map.completion?.passed);
              const lengthLabel = map.length != null ? `${Math.floor(map.length / 60_000)}:${String(Math.round((map.length % 60_000) / 1000)).padStart(2, "0")}` : null;
              return (
                <article key={map.id} className="flex flex-col rounded-3xl border-2 bg-surface/95 p-5 shadow-glow" style={{ borderColor: scored ? "#34d399" : `${map.rankColor}99`, boxShadow: scored ? "0 0 28px #34d39922" : `0 0 28px ${map.rankColor}14` }}>
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/maps/${map.id}`} className="min-w-0 rounded-2xl transition hover:bg-background/40 focus:outline-none focus:ring-2 focus:ring-accent/50">
                      <p className="text-sm text-muted">{map.artist ?? "Unknown artist"}</p>
                      <h3 className="mt-1 truncate text-xl font-semibold text-white hover:text-accent">{map.title}</h3>
                      <p className="mt-1 text-xs text-muted">Mapped by {map.mapperName ?? map.submittedBy?.displayName ?? "Unknown"}</p>
                    </Link>
                    {map.rating != null && <div className="flex shrink-0 flex-col items-end gap-1"><span className="inline-flex rounded-full px-2.5 py-1 text-sm font-semibold" style={{ color: scored ? "#34d399" : map.rankColor, border: `1px solid ${scored ? "#34d39980" : `${map.rankColor}80`}`, backgroundColor: `${scored ? "#34d399" : map.rankColor}14` }}>{map.rating.toFixed(2)}</span><span className="text-[11px] font-semibold" style={{ color: map.rankColor }}>{rank.name}</span></div>}
                  </div>

                  <Link href={`/maps/${map.id}`} className="mt-3 block rounded-2xl transition hover:bg-background/20 focus:outline-none focus:ring-2 focus:ring-accent/50">
                    <div className="flex flex-wrap gap-2 text-xs text-muted">
                      {scored && <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-300">Score found</span>}
                      {map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{map.noteCount.toLocaleString()} notes</span>}
                      {lengthLabel && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">{lengthLabel}</span>}
                      <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">Rating: {map.rating != null ? map.rating.toFixed(2) : "—"}</span>
                    </div>
                    {map.rating != null && <p className="mt-3 inline-flex items-center gap-1.5 text-xs" style={{ color: map.rankColor }}><span className="font-semibold text-white">{rhpGainForMap(map.rating, 100, undefined, rankInfo.index).toLocaleString()} RHP</span><span className="text-muted">at 100% accuracy · {rhpGainForMap(map.rating, 100, 2, rankInfo.index).toLocaleString()} with a speed modifier</span></p>}
                  </Link>

                  {map.reviewedBy && <p className="mt-3 text-xs text-muted">Approved by <Link href={`/profile/${map.reviewedBy.profileHandle}`} className="font-semibold text-white hover:text-accent">{map.reviewedBy.displayName ?? map.reviewedBy.username}</Link></p>}

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    <a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20"><Download size={15} /> Download</a>
                    <button type="button" onClick={() => void checkMap(map.id)} disabled={busyId === map.id} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-60"><RefreshCw size={15} className={busyId === map.id ? "animate-spin" : ""} />{busyId === map.id ? "Checking..." : "Check my score"}</button>
                  </div>

                  {message && <p className={`mt-3 rounded-2xl border p-3 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : message.tone === "warn" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>{message.text}</p>}
                </article>
              );
            })}
          </div>
          {filtered.length > visibleMaps.length && <div className="flex justify-center pt-2"><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/20"><ChevronDown size={16} /> Show more maps ({filtered.length - visibleMaps.length} remaining)</button></div>}
        </>
      )}

      <div className="flex justify-center pt-2"><Link href="/maps/submit" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2"><MapIcon size={16} /> Submit a map for review</Link></div>
    </div>
  );
}
