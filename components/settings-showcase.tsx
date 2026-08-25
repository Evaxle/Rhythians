"use client";

import { useEffect, useState } from "react";
import { Download, Play, Settings2, Trophy } from "lucide-react";
import { RankIcon } from "@/components/rank-icon";
import { getRankInfo } from "@/lib/ranks";

type Entry = { id: string; cameraMode: "lock" | "spin"; settingsFileUrl: string; settingsFileName: string; videoUrl: string; title: string | null; description: string | null; username: string; displayName: string | null; profileHandle: string; avatar: string | null; globalRank: number | null; rhp: number; rhythianRank: string | null; rhythianRankColor: string | null };

export function SettingsShowcase() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mode, setMode] = useState<"all" | "lock" | "spin">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load settings showcases.");
      setEntries((await response.json()).settings ?? []);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load settings showcases.")).finally(() => setLoading(false));
  }, []);

  const visible = entries.filter((entry) => mode === "all" || entry.cameraMode === mode);

  return <section className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-accent"><Settings2 size={16} /> Player settings</p><h2 className="mt-2 text-2xl font-semibold text-white">Community settings showcase</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-muted">Download settings from featured players and watch the gameplay selected by the Rhythians team.</p></div><div className="flex flex-wrap gap-2">{(["all", "lock", "spin"] as const).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-full border px-4 py-2 text-xs font-semibold ${mode === value ? "border-accent/50 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:text-white"}`}>{value === "all" ? "All" : value === "lock" ? "Camera Lock" : "Camera Spin"}</button>)}</div></div>{error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{loading ? <p className="rounded-2xl border border-border bg-background/50 p-6 text-sm text-muted">Loading settings...</p> : visible.length === 0 ? <p className="rounded-2xl border border-dashed border-border bg-background/50 p-8 text-center text-sm text-muted">No settings have been published yet.</p> : <div className="grid gap-5 lg:grid-cols-2">{visible.map((entry) => { const rank = getRankInfo(entry.rhp); return <article key={entry.id} className="overflow-hidden rounded-3xl border border-border bg-background/45"><div className="aspect-video bg-black"><video src={entry.videoUrl} controls preload="metadata" className="h-full w-full object-cover" /></div><div className="space-y-4 p-5"><div className="flex items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-background">{entry.avatar ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted"><Trophy size={19} /></div>}</div><div className="min-w-0 flex-1"><a href={`/profile/${encodeURIComponent(entry.profileHandle)}`} className="truncate text-base font-bold text-white hover:text-accent">{entry.displayName ?? entry.username}</a><p className="text-xs text-muted">{entry.cameraMode === "lock" ? "Camera Lock" : "Camera Spin"} · {entry.globalRank != null ? `Global #${entry.globalRank}` : "No global rank"}</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"><RankIcon rank={rank} size={42} /><div><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Rhythian rank</p><p className="text-sm font-semibold" style={{ color: rank.color }}>{rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`}</p><p className="text-xs text-muted">{entry.rhp.toLocaleString()} RHP</p></div>{entry.rhythianRank && <span className="ml-auto text-xs font-semibold" style={{ color: entry.rhythianRankColor ?? undefined }}>{entry.rhythianRank}</span>}</div>{entry.title && <h3 className="text-lg font-bold text-white">{entry.title}</h3>}{entry.description && <p className="text-sm leading-6 text-muted">{entry.description}</p>}<div className="flex flex-wrap gap-2"><a href={entry.settingsFileUrl} download={entry.settingsFileName} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent2"><Download size={14} /> Download settings</a><a href={entry.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white"><Play size={14} /> Open video</a></div></div></article>; })}</div>}</section>;
}
