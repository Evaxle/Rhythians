"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

const MARKER = new TextEncoder().encode("\nRHYM_ZIP_START\n");

function findMarker(buffer: Uint8Array) {
  outer: for (let index = 0; index <= buffer.length - MARKER.length; index += 1) {
    for (let offset = 0; offset < MARKER.length; offset += 1) if (buffer[index + offset] !== MARKER[offset]) continue outer;
    return index;
  }
  return -1;
}

export function DownloadRankedMapsButton({ rankLabel }: { rankLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<{ downloaded: number; total: number } | null>(null);

  async function handleDownload(mode: "ranked" | "ranked-legacy" | "legacy") {
    setBusy(true);
    setOpen(false);
    setProgress(null);
    try {
      const response = await fetch(`/api/maps/download-rank?mode=${mode}&progress=1`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not download the maps.");
      }
      if (!response.body) throw new Error("The download stream is unavailable.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let markerIndex = -1;
      let buffer = new Uint8Array(0);
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        totalBytes += value.length;
        if (markerIndex < 0) {
          const merged = new Uint8Array(buffer.length + value.length);
          merged.set(buffer); merged.set(value, buffer.length); buffer = merged;
          markerIndex = findMarker(buffer);
          if (markerIndex >= 0) {
            const header = decoder.decode(buffer.slice(0, markerIndex));
            for (const line of header.split("\n")) {
              if (!line.startsWith("PROGRESS ")) continue;
              try { const item = JSON.parse(line.slice(9)) as { downloaded: number; total: number }; setProgress(item); } catch {}
            }
          } else if (buffer.length > 8192) buffer = buffer.slice(buffer.length - MARKER.length + 1);
        }
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("PROGRESS ")) continue;
          try { const item = JSON.parse(line.slice(9)) as { downloaded: number; total: number }; setProgress(item); } catch {}
        }
      }
      const all = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
      const finalMarker = findMarker(all);
      if (finalMarker < 0) throw new Error("The ZIP download was incomplete.");
      const zipStart = finalMarker + MARKER.length;
      const zip = all.slice(zipStart);
      if (zip.length < 22) throw new Error("The downloaded ZIP is invalid.");
      const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${rankLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${mode}-maps.zip`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setProgress((current) => current ? { ...current, downloaded: current.total } : current);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not download the maps.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="relative"><button type="button" onClick={() => setOpen(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-wait disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{busy ? "Downloading maps..." : `Download all ${rankLabel} maps`}</button>{busy && progress && <div className="absolute right-0 top-full z-40 mt-2 min-w-64 rounded-2xl border border-border bg-surface p-4 shadow-2xl"><div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-white">Downloading maps</span><span className="text-sm font-bold text-accent">{progress.downloaded}/{progress.total}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-accent transition-all duration-200" style={{ width: `${progress.total ? Math.min(100, progress.downloaded / progress.total * 100) : 0}%` }} /></div></div>}{open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={() => !busy && setOpen(false)}><div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><h2 className="text-xl font-semibold text-white">Download {rankLabel} maps</h2><p className="mt-2 text-sm leading-6 text-muted">Choose which maps to include in your download.</p><div className="mt-5 grid gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-2xl border border-border bg-white/5 px-4 py-3 text-left text-sm font-semibold text-muted transition hover:text-white">Cancel</button><button type="button" onClick={() => void handleDownload("ranked")} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Download all ranked</button><button type="button" onClick={() => void handleDownload("ranked-legacy")} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Ranked plus legacy</button><button type="button" onClick={() => void handleDownload("legacy")} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Download just legacy maps</button></div></div></div>}</div>;
}
