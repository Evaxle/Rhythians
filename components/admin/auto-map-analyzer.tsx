"use client";

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";

type AutoResponse = {
  error?: string;
  done?: boolean;
  source?: "ranked" | "unranked" | "legacy" | null;
  processed?: number;
  succeeded?: number;
  failed?: number;
  stats?: { total: number; analyzed: number; failed: number; pending: number };
};

export function AutoMapAnalyzer() {
  const [status, setStatus] = useState("Starting automatic analyzer…");
  const [error, setError] = useState("");
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (stopped.current) return;
      timer = setTimeout(() => void run(), ms);
    };

    const run = async () => {
      if (stopped.current) return;
      if (document.visibilityState !== "visible") {
        schedule(15000);
        return;
      }

      try {
        const response = await fetch("/api/admin/maps/auto-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        const data = await response.json() as AutoResponse;
        if (!response.ok) throw new Error(data.error ?? "Automatic analysis failed.");

        setError("");
        if (data.done) {
          setStatus("All ranked, unranked, and legacy maps are current.");
          schedule(60000);
          return;
        }

        const label = data.source ? `${data.source[0].toUpperCase()}${data.source.slice(1)}` : "Maps";
        const stats = data.stats;
        setStatus(
          `${label}: ${stats?.analyzed ?? 0}/${stats?.total ?? 0} current · ${stats?.pending ?? 0} pending · ${stats?.failed ?? 0} failed.`,
        );
        schedule((data.processed ?? 0) > 0 ? 10000 : 30000);
      } catch (runError) {
        setError(runError instanceof Error ? runError.message : "Automatic analysis failed.");
        schedule(30000);
      }
    };

    void run();
    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 shadow-glow">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><Activity size={17} /></div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Automatic latest-version analysis</p>
        <p className="mt-1 text-sm text-white">{status}</p>
        <p className="mt-1 text-xs leading-5 text-muted">Runs in small batches while this page is open and always prioritizes Ranked → Unranked → Legacy. A daily server job continues catch-up when no admin is here.</p>
        {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
      </div>
    </div>
  </section>;
}
