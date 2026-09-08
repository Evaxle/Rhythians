"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function CheckAllRankedMapsButton() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  const lastCheckRef = useRef(0);

  async function checkAll(manual = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setChecking(true);
    if (manual) setMessage("");
    try {
      const response = await fetch("/api/maps/check-all", { method: "POST", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check your scores.");
      lastCheckRef.current = Date.now();
      const summary = `Synced ${data.foundScores} unique scores · 🔒 ${data.rpl} RPL · 🌀 ${data.rps} RPS · 🥽 ${data.rpv} RPV · ${data.rhp} RHP.`;
      if (manual || Number(data.added ?? 0) > 0) setMessage(summary);
      router.refresh();
    } catch (error) {
      if (manual) setMessage(error instanceof Error ? error.message : "Unable to check your scores.");
    } finally {
      busyRef.current = false;
      setChecking(false);
    }
  }

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckRef.current < 29_000) return;
      void checkAll(false);
    };
    const timer = window.setInterval(tick, 30_000);
    const onVisibility = () => { if (document.visibilityState === "visible") tick(); };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void checkAll(true)} disabled={checking} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/20 disabled:opacity-60"><RefreshCw size={15} className={checking ? "animate-spin" : ""} />{checking ? "Syncing..." : "Check all my maps"}</button><span className="text-xs text-muted">Auto-checks every 30s while this page is open.</span>{message && <span className="text-xs text-muted">{message}</span>}</div>;
}
