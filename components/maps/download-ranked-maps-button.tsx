"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

export function DownloadRankedMapsButton({ rankLabel }: { rankLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<{ downloaded: number; processed: number; total: number; failed: number } | null>(null);
  const [completed, setCompleted] = useState(false);

  async function handleDownload(mode: "ranked" | "ranked-legacy" | "legacy") {
    setBusy(true); setOpen(false); setCompleted(false); setProgress(null);
    try {
      const response = await fetch(`/api/maps/download-rank?mode=${mode}&progress=1`, { cache: "no-store" });
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error ?? "Could not download the maps."); }
      if (!response.body) throw new Error("The download stream is unavailable.");
      const reader = response.body.getReader(); const zipChunks: Uint8Array[] = []; let buffer = new Uint8Array(0);
      const append = (left: Uint8Array, right: Uint8Array) => { const merged = new Uint8Array(left.length + right.length); merged.set(left); merged.set(right, left.length); return merged; };
      while (true) {
        const { done, value } = await reader.read(); if (done) break; if (!value) continue; buffer = append(buffer, value);
        while (buffer.length >= 5) {
          const type = buffer[0]; const length = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(1); if (buffer.length < 5 + length) break;
          const payload = buffer.slice(5, 5 + length); buffer = buffer.slice(5 + length);
          if (type === 1) { const item = JSON.parse(new TextDecoder().decode(payload)) as { downloaded: number; processed: number; total: number; failed: number }; setProgress(item); }
          else if (type === 2) zipChunks.push(payload);
          else if (type === 3) { const item = JSON.parse(new TextDecoder().decode(payload)) as { message?: string }; throw new Error(item.message ?? "Could not build the ZIP."); }
        }
      }
      if (buffer.length !== 0 || zipChunks.length === 0) throw new Error("The ZIP download was incomplete.");
      const zip = new Uint8Array(zipChunks.reduce((total, chunk) => total + chunk.length, 0)); let offset = 0; for (const chunk of zipChunks) { zip.set(chunk, offset); offset += chunk.length; }
      if (zip.length < 22 || zip[0] !== 0x50 || zip[1] !== 0x4b) throw new Error("The downloaded ZIP is invalid.");
      const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${rankLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${mode}-maps.zip`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000); setCompleted(true);
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not download the maps."); }
    finally { setBusy(false); }
  }

  return <div className="relative"><button type="button" onClick={() => setOpen(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-wait disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{busy ? "Downloading maps..." : `Download all ${rankLabel} maps`}</button>{progress && <div className="absolute right-0 top-full z-40 mt-2 min-w-72 rounded-2xl border border-border bg-surface p-4 shadow-2xl"><div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-white">{completed ? "Download complete" : "Downloading maps"}</span><span className="text-sm font-bold text-accent">{progress.downloaded}/{progress.total}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-accent transition-all duration-200" style={{ width: `${progress.total ? Math.min(100, progress.processed / progress.total * 100) : 0}%` }} /></div>{progress.failed > 0 && <p className="mt-2 text-xs text-amber-300">{progress.failed} map{progress.failed === 1 ? "" : "s"} failed and were listed in download-errors.txt.</p>}{completed && progress.downloaded === progress.total && <p className="mt-2 text-xs text-muted">All {progress.total} maps were added to the ZIP.</p>}</div>}{open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={() => !busy && setOpen(false)}><div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><h2 className="text-xl font-semibold text-white">Download {rankLabel} maps</h2><p className="mt-2 text-sm leading-6 text-muted">Choose which maps to include in your download.</p><div className="mt-5 grid gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-2xl border border-border bg-white/5 px-4 py-3 text-left text-sm font-semibold text-muted transition hover:text-white">Cancel</button><button type="button" onClick={() => void handleDownload("ranked")} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Download all ranked</button><button type="button" onClick={() => void handleDownload("ranked-legacy")} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Ranked plus legacy</button><button type="button" onClick={() => void handleDownload("legacy")} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Download just legacy maps</button></div></div></div>}</div>;
}
