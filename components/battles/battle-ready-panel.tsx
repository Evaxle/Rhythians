"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";

export function BattleReadyPanel({ matchId }: { matchId: string }) {
  const [data, setData] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch(`/api/battles/matches?id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      if (!response.ok) return;
      setData(await response.json());
    } catch {}
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 1000);
    return () => clearInterval(timer);
  }, [matchId]);

  if (!data?.match || data.match.status === "active" || data.match.status === "finished" || data.match.status === "queue" || data.match.status === "invite" || !data.match.mapId) return null;
  const players = data.players ?? [];
  const viewer = players.find((player: any) => player.userId === data.viewerId);
  const readyCount = players.filter((player: any) => player.readyAt).length;
  const isReady = Boolean(viewer?.readyAt);

  async function ready() {
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/battles/matches/${encodeURIComponent(matchId)}/ready`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not ready for this battle.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ready for this battle.");
    } finally {
      setWorking(false);
    }
  }

  return <section className="ui-card rounded-[2rem] p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><ShieldCheck size={15} /> Ready check</p><h2 className="mt-2 text-xl font-semibold text-white">{readyCount} / {players.length} players ready</h2><p className="mt-1 text-sm text-muted">The battle starts only after every player is ready.</p></div>
      <button disabled={working || isReady} onClick={() => void ready()} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{working ? <Loader2 className="animate-spin" size={17} /> : <Check size={17} />}{isReady ? "Ready" : "Ready up"}</button>
    </div>
    {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
  </section>;
}