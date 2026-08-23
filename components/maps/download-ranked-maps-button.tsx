"use client";

import { Download } from "lucide-react";
import { useState } from "react";

export function DownloadRankedMapsButton({ rankLabel }: { rankLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDownload(mode: "ranked" | "ranked-legacy" | "legacy") {
    setBusy(true);
    try {
      const response = await fetch(`/api/maps/download-rank?mode=${mode}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not download the maps.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${rankLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${mode}-maps.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not download the maps.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-wait disabled:opacity-50"><Download size={16} />{busy ? "Preparing maps..." : `Download all ${rankLabel} maps`}</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={() => !busy && setOpen(false)}><div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><h2 className="text-xl font-semibold text-white">Download {rankLabel} maps</h2><p className="mt-2 text-sm leading-6 text-muted">Choose which maps to include in your download.</p><div className="mt-5 grid gap-2"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-2xl border border-border bg-white/5 px-4 py-3 text-left text-sm font-semibold text-muted transition hover:text-white">Cancel</button><button type="button" onClick={() => void handleDownload("ranked")} disabled={busy} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Download all ranked</button><button type="button" onClick={() => void handleDownload("ranked-legacy")} disabled={busy} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Ranked plus legacy</button><button type="button" onClick={() => void handleDownload("legacy")} disabled={busy} className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40">Download just legacy maps</button></div></div></div>}
  </div>;
}
