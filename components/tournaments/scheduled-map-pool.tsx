"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, MapPinned, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";

export function ScheduledMapPool({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<"regular" | "finals">("regular");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/map-pool?ts=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
      const result = await response.json().catch(() => null);
      if (response.ok) setData(result);
      else if (response.status === 401 || response.status === 403) setData(null);
    } catch {
      // Keep the last good pool visible through temporary network failures.
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  async function refresh() {
    setLoading(true);
    await load();
    setLoading(false);
  }

  async function action(payload: Record<string, unknown>) {
    setMessage("");
    const response = await fetch(`/api/tournaments/${tournamentId}/map-pool`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload) });
    const result = await response.json();
    setMessage(response.ok ? "Saved." : result.error ?? "Could not save.");
    if (response.ok) { setUrl(""); await load(); }
  }

  if (!data) return null;
  const regular = data.maps.filter((map: any) => map.stage === "regular");
  const finals = data.maps.filter((map: any) => map.stage === "finals");
  const render = (maps: any[]) => <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">{maps.map((map: any) => <article key={map.mapId} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words font-bold text-white">{map.title}</p><p className="mt-1 break-words text-xs text-muted">{map.artist || "Unknown artist"} · {Number(map.rating).toFixed(2)} rating</p></div><span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] text-muted">{Number(map.sourcePlaycount ?? 0).toLocaleString()} plays</span></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => action({ action: "vote", mapId: map.mapId, value: 1 })} className={`ui-button !px-3 !py-2 text-xs ${map.viewerVote === 1 ? "bg-emerald-400/20 text-emerald-100" : "bg-white/5"}`}><ThumbsUp size={13} /> {map.likes}</button><button onClick={() => action({ action: "vote", mapId: map.mapId, value: -1 })} className={`ui-button !px-3 !py-2 text-xs ${map.viewerVote === -1 ? "bg-rose-400/20 text-rose-100" : "bg-white/5"}`}><ThumbsDown size={13} /> {map.dislikes}</button><button onClick={() => { const reason = window.prompt("Why should this map be removed and replaced?"); if (reason) void action({ action: "report", mapId: map.mapId, reason }); }} className="ui-button !px-3 !py-2 text-xs bg-white/5"><Flag size={13} /> Report</button></div></article>)}</div>;

  return <section className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-surface/95 p-4 sm:p-6"><div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><MapPinned size={15} /> Your {data.split} split map pool</p><h2 className="mt-2 break-words text-2xl font-black text-white">Vote on the scheduled maps</h2><p className="mt-2 text-sm text-muted">Regular maps must be {data.rules.regular[0].toFixed(1)}–{data.rules.regular[1].toFixed(1)}. Semi-final/final maps must be {data.rules.finals[0].toFixed(1)}–{data.rules.finals[1].toFixed(1)}.</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted">{data.maps.length} maps</span><button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh map pool" className="ui-button !p-2.5 bg-white/5 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button></div></div><div className="mt-6"><h3 className="mb-3 font-bold text-white">Regular pool · {regular.length}</h3>{render(regular)}</div><div className="mt-7"><h3 className="mb-3 font-bold text-white">Semi-finals & finals candidates · {finals.length}</h3>{render(finals)}</div><div className="mt-7 min-w-0 rounded-2xl border border-accent/15 bg-accent/[0.04] p-4"><p className="font-bold text-white">Recommend a replacement</p><p className="mt-1 text-xs text-muted">Paste a Rhythia or Rhythians map URL. The server verifies that it is ranked and inside the required rating range.</p><div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row"><select value={stage} onChange={(event) => setStage(event.target.value as "regular" | "finals")} className="ui-input min-w-0 sm:w-52"><option value="regular">Regular {data.rules.regular[0].toFixed(1)}–{data.rules.regular[1].toFixed(1)}</option><option value="finals">Finals {data.rules.finals[0].toFixed(1)}–{data.rules.finals[1].toFixed(1)}</option></select><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.rhythia.com/maps/..." className="ui-input min-w-0 flex-1" /><button onClick={() => action({ action: "recommend", mapUrl: url, stage })} disabled={!url.trim()} className="ui-button shrink-0 bg-accent text-white">Recommend</button></div>{message && <p className="mt-2 text-xs text-muted">{message}</p>}</div></section>;
}
