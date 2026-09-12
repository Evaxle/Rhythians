"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, ExternalLink, Settings2, Trophy, UserRound } from "lucide-react";
import { RankIcon } from "@/components/rank-icon";
import { getRankInfo } from "@/lib/ranks";
import { LoopingVideoPreview } from "@/components/looping-video-preview";
import { SettingsOwnerEditor } from "@/components/settings-owner-editor";

type Entry = {
  id: string;
  cameraMode: "lock" | "spin";
  settingsFileUrl: string | null;
  settingsFileName: string;
  videoUrl: string | null;
  title: string | null;
  description: string | null;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  globalRank: number | null;
  rhythiansGlobalRank: number | null;
  rhp: number;
  profileUsername: string | null;
  profileUrl: string | null;
  country: string | null;
  flag: string | null;
  rhythianRank: string | null;
  rhythianRankColor: string | null;
  canEdit: boolean;
};

const SPIN_WARNING_KEY = "rhythians:community-settings:spin-warning:v1";

export function SettingsShowcase() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mode, setMode] = useState<"lock" | "spin">("lock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [spinWarning, setSpinWarning] = useState(false);
  const refreshing = useRef(false);

  async function load(silent = false) {
    if (refreshing.current) return;
    refreshing.current = true;
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to load community settings.");
      setEntries(Array.isArray(data?.settings) ? data.settings : []);
      setError("");
    } catch (reason) {
      if (!silent) setError(reason instanceof Error ? reason.message : "Unable to load community settings.");
    } finally {
      refreshing.current = false;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load(false);
    const tick = () => { if (document.visibilityState === "visible") void load(true); };
    const timer = window.setInterval(tick, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function chooseMode(next: "lock" | "spin") {
    if (next === "spin") {
      try {
        if (!window.localStorage.getItem(SPIN_WARNING_KEY)) {
          setSpinWarning(true);
          return;
        }
      } catch {}
    }
    setMode(next);
  }

  function acceptSpinWarning() {
    try { window.localStorage.setItem(SPIN_WARNING_KEY, "1"); } catch {}
    setSpinWarning(false);
    setMode("spin");
  }

  const visible = useMemo(() => entries.filter((entry) => entry.cameraMode === mode).sort((a, b) => (a.globalRank ?? Number.MAX_SAFE_INTEGER) - (b.globalRank ?? Number.MAX_SAFE_INTEGER) || a.username.localeCompare(b.username)), [entries, mode]);

  return (
    <div className="ui-page space-y-6">
      {spinWarning && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-amber-400/30 bg-surface p-6 shadow-2xl"><div className="flex items-center gap-3 text-amber-300"><AlertTriangle size={24} /><h2 className="text-xl font-semibold text-white">Flashing motion warning</h2></div><p className="mt-4 text-sm leading-6 text-muted">Spin gameplay previews can contain rapid camera movement, flashing effects, and fast visual changes. Continue only if you are comfortable viewing this content.</p><div className="mt-6 flex gap-3"><button type="button" onClick={acceptSpinWarning} className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black">Continue to Spin</button><button type="button" onClick={() => setSpinWarning(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:text-white">Stay on Lock</button></div></div></div>}

      <section className="ui-page-header">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent"><Settings2 size={15} /> Community settings</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Player settings</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Live Rhythia ranks refresh every 30 seconds. Settings are ordered from highest to lowest Rhythia global rank and include downloadable RHS files plus looping gameplay previews.</p></div>
          <div className="flex rounded-2xl border border-border bg-background/60 p-1"><button type="button" onClick={() => chooseMode("spin")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${mode === "spin" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-white"}`}>Spin</button><button type="button" onClick={() => chooseMode("lock")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${mode === "lock" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-white"}`}>Lock</button></div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
      {loading ? <section className="rounded-3xl border border-border bg-surface/70 p-8 text-sm text-muted shadow-glow">Loading connected Rhythia profiles and settings...</section> : visible.length === 0 ? <section className="rounded-3xl border border-dashed border-border bg-surface/70 p-12 text-center shadow-glow"><Trophy className="mx-auto text-muted" size={38} /><p className="mt-4 text-sm font-semibold text-white">No {mode === "lock" ? "camera lock" : "camera spin"} settings published yet</p></section> : <section className="space-y-5">
        {visible.map((entry) => {
          const rank = getRankInfo(Number(entry.rhp ?? 0));
          const displayName = entry.displayName || entry.profileUsername || entry.username;
          return <article key={entry.id} className="group relative overflow-hidden rounded-3xl border bg-surface/95 shadow-glow transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl" style={{ borderColor: `${rank.color}30`, background: `radial-gradient(circle at 100% 0%, ${rank.color}16, transparent 45%), rgba(15,20,34,0.95)` }}><div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,48%)]"><div className="min-w-0 p-6 sm:p-7 lg:p-8">
            <div className="flex items-center gap-3"><div className="relative shrink-0"><div className="h-14 w-14 overflow-hidden rounded-2xl border-2 bg-background" style={{ borderColor: `${rank.color}70` }}>{entry.avatar ? <img src={entry.avatar} alt={displayName} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted"><UserRound size={24} /></div>}</div><span className="absolute -bottom-2 -right-2 rounded-xl border border-surface bg-surface p-0.5"><RankIcon rank={rank} size={28} /></span></div><div className="min-w-0"><a href={`/profile/${encodeURIComponent(entry.profileHandle)}`} className="block truncate text-base font-semibold text-white hover:text-accent">{displayName}</a><p className="mt-1 truncate text-xs text-muted">{entry.profileUsername ? `Rhythia: ${entry.profileUsername}` : `@${entry.profileHandle}`}</p>{entry.country ? <p className="mt-1 text-xs text-muted">{entry.flag ? `${entry.flag} ` : ""}{entry.country}</p> : null}</div></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border bg-background/50 p-3"><p className="text-xs uppercase tracking-[0.16em] text-muted">Rhythians global rank</p><p className="mt-1 text-lg font-bold text-white">{entry.rhythiansGlobalRank ? `#${entry.rhythiansGlobalRank.toLocaleString()}` : "Unavailable"}</p></div><div className="rounded-2xl border border-border bg-background/50 p-3"><p className="text-xs uppercase tracking-[0.16em] text-muted">Rhythia global rank</p><p className="mt-1 text-lg font-bold text-white">{entry.globalRank ? `#${entry.globalRank.toLocaleString()}` : "Unavailable"}</p></div><div className="rounded-2xl border border-border bg-background/50 p-3"><div className="flex items-center gap-2"><RankIcon rank={rank} size={30} /><div><p className="text-xs uppercase tracking-[0.16em] text-muted">Player classification</p><p className="text-sm font-semibold" style={{ color: entry.rhythianRankColor || rank.color }}>{entry.rhythianRank || (rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`)}</p></div></div></div><div className="rounded-2xl border border-border bg-background/50 p-3"><p className="text-xs uppercase tracking-[0.16em] text-muted">Rhythians points</p><p className="mt-1 text-sm font-semibold text-white">{Number(entry.rhp ?? 0).toLocaleString()} RHP</p></div></div>
            {entry.title ? <h2 className="mt-5 text-xl font-bold text-white">{entry.title}</h2> : null}{entry.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{entry.description}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">{entry.settingsFileUrl ? <a href={entry.settingsFileUrl} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent2"><Download size={14} /> Download {entry.settingsFileName || "RHS"}</a> : null}{entry.profileUrl ? <a href={entry.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent/40 hover:text-white"><ExternalLink size={14} /> Rhythia profile</a> : null}</div>
            {entry.canEdit && <SettingsOwnerEditor id={entry.id} onUpdated={() => void load(true)} />}
          </div><div className="relative overflow-hidden bg-black"><LoopingVideoPreview src={entry.videoUrl} title={`${displayName} ${mode} settings preview`} /><span className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur">Muted · looping preview</span></div></div></article>;
        })}
      </section>}
    </div>
  );
}
