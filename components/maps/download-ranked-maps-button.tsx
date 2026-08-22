"use client";

import { Download } from "lucide-react";
import { useState } from "react";

export function DownloadRankedMapsButton({ rankLabel }: { rankLabel: string }) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      const response = await fetch("/api/maps/download-rank", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not download the ranked maps.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${rankLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-ranked-maps.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not download the ranked maps.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handleDownload} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-wait disabled:opacity-50">
      <Download size={16} />
      {busy ? "Preparing maps..." : `Download all ${rankLabel} ranked maps`}
    </button>
  );
}
