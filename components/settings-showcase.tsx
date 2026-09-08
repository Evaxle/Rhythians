"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Settings2, Trophy, UserRound } from "lucide-react";
import { RankIcon } from "@/components/rank-icon";
import { getRankInfo } from "@/lib/ranks";
import { LoopingVideoPreview } from "@/components/looping-video-preview";

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
};

export function SettingsShowcase() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mode, setMode] = useState<"lock" | "spin">("lock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Unable to load community settings.");
        if (!cancelled) setEntries(Array.isArray(data?.settings) ? data.settings : []);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load community settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => entries.filter((entry) => entry.cameraMode === mode).sort((a, b) => (a.globalRank ?? Number.MAX_SAFE_INTEGER) - (b.globalRank ?? Number.MAX_SAFE_INTEGER)),
    [entries, mode]
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-5 sm:px-6 lg:py-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface/95 p-6 shadow-glow sm:p-8">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent"><Settings2 size={15} /> Community settings</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Player settings</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Browse shared Rhythia settings with the player&apos;s real connected Rhythia rank, Rhythians leaderboard position, downloadable RHS file, and looping gameplay preview.</p>
          </div>
          <div className="flex rounded-2xl border border-border bg-background/60 p-1">
            <button type="button" onClick={() => setMode("spin")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${mode === "spin" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-white"}`}>Spin</button>
            <button type="button" onClick={() => setMode("lock")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${mode === "lock" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-white"}`}>Lock</button>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}

      {loading ? (
        <section className="rounded-3xl border border-border bg-surface/70 p-8 text-sm text-muted shadow-glow">Loading connected Rhythia profiles and settings...</section>
      ) : visible.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border bg-surface/70 p-12 text-center shadow-glow">
          <Trophy className="mx-auto text-muted" size={38} />
          <p className="mt-4 text-sm font-semibold text-white">No {mode === "lock" ? "camera lock" : "camera spin"} settings published yet</p>
          <p className="mt-1 text-sm text-muted">Community settings added by the Rhythians team will appear here.</p>
        </section>
      ) : (
        <section className="space-y-5">
          {visible.map((entry) => {
            const rank = getRankInfo(Number(entry.rhp ?? 0));
            const displayName = entry.displayName || entry.profileUsername || entry.username;
            return (
              <article key={entry.id} className="group relative overflow-hidden rounded-3xl border bg-surface/95 shadow-glow transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl" style={{ borderColor: `${rank.color}30`, background: `radial-gradient(circle at 100% 0%, ${rank.color}16, transparent 45%), rgba(15,20,34,0.95)` }}>
                <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,48%)]">
                  <div className="min-w-0 p-6 sm:p-7 lg:p-8">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="h-14 w-14 overflow-hidden rounded-2xl border-2 bg-background" style={{ borderColor: `${rank.color}70` }}>
                          {entry.avatar ? <img src={entry.avatar} alt={displayName} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted"><UserRound size={24} /></div>}
                        </div>
                        <span className="absolute -bottom-2 -right-2 rounded-xl border border-surface bg-surface p-0.5"><RankIcon rank={rank} size={28} /></span>
                      </div>
                      <div className="min-w-0">
                        <a href={`/profile/${encodeURIComponent(entry.profileHandle)}`} className="block truncate text-base font-semibold text-white hover:text-accent">{displayName}</a>
                        <p className="mt-1 truncate text-xs text-muted">{entry.profileUsername ? `Rhythia: ${entry.profileUsername}` : `@${entry.profileHandle}`}</p>
                        {entry.country ? <p className="mt-1 text-xs text-muted">{entry.flag ? `${entry.flag} ` : ""}{entry.country}</p> : null}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-background/50 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Rhythians global rank</p>
                        <p className="mt-1 text-lg font-bold text-white">{entry.rhythiansGlobalRank ? `#${entry.rhythiansGlobalRank.toLocaleString()}` : "Unavailable"}</p>
                        <p className="mt-1 text-xs text-muted">Placement on the Rhythians RHP leaderboard</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/50 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Rhythia global rank</p>
                        <p className="mt-1 text-lg font-bold text-white">{entry.globalRank ? `#${entry.globalRank.toLocaleString()}` : "Unavailable"}</p>
                        <p className="mt-1 text-xs text-muted">Live rank from the connected Rhythia profile</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/50 p-3">
                        <div className="flex items-center gap-2"><RankIcon rank={rank} size={30} /><div><p className="text-[10px] uppercase tracking-[0.16em] text-muted">Player classification</p><p className="text-sm font-semibold" style={{ color: entry.rhythianRankColor || rank.color }}>{entry.rhythianRank || (rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`)}</p></div></div>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/50 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Rhythians points</p>
                        <p className="mt-1 text-sm font-semibold text-white">{Number(entry.rhp ?? 0).toLocaleString()} RHP</p>
                      </div>
                    </div>

                    {entry.title ? <h2 className="mt-5 text-xl font-bold text-white">{entry.title}</h2> : null}
                    {entry.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{entry.description}</p> : null}

                    <div className="mt-6 flex flex-wrap gap-2">
                      {entry.settingsFileUrl ? <a href={entry.settingsFileUrl} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent2"><Download size={14} /> Download {entry.settingsFileName || "RHS"}</a> : null}
                      {entry.profileUrl ? <a href={entry.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent/40 hover:text-white"><ExternalLink size={14} /> Rhythia profile</a> : null}
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-black">
                    <LoopingVideoPreview src={entry.videoUrl} title={`${displayName} ${mode} settings preview`} />
                    <span className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur">Muted · looping preview</span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
