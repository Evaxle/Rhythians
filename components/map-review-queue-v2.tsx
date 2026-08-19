"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Link2, Map as MapIcon, Swords, Trophy, User as UserIcon } from "lucide-react";

type PendingMap = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  mapFileUrl: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  requestedRating: number;
  mapperName: string | null;
  noteCount: number | null;
  length: number | null;
  createdAt: string;
  submissionType: "ranked" | "challenge";
  challengePlacement: "main" | "jumps" | "stream" | "tech" | "off_grid" | null;
  challengeLevel: number | null;
  submittedBy: { username: string; displayName: string | null; profileHandle: string; avatar: string | null };
};

const placements = [
  { value: "main", label: "Main Challenge" },
  { value: "jumps", label: "Jumps" },
  { value: "stream", label: "Stream" },
  { value: "tech", label: "Tech" },
  { value: "off_grid", label: "Off-Grid" },
] as const;

export function MapReviewQueueV2({ initialMaps }: { initialMaps: PendingMap[] }) {
  const [maps, setMaps] = useState(initialMaps);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [placement, setPlacement] = useState<Record<string, PendingMap["challengePlacement"]>>(() => Object.fromEntries(initialMaps.map((map) => [map.id, map.challengePlacement])));
  const [level, setLevel] = useState<Record<string, string>>(() => Object.fromEntries(initialMaps.map((map) => [map.id, map.challengeLevel ? String(map.challengeLevel) : "1"])));

  async function moderate(id: string, status: "approved" | "rejected") {
    setError("");
    setBusyId(id);
    try {
      const map = maps.find((entry) => entry.id === id);
      const selectedPlacement = placement[id] ?? null;
      const selectedLevel = Number(level[id] ?? "1");
      if (status === "approved" && map?.submissionType === "challenge" && !selectedPlacement) throw new Error("Choose Main Challenge or a skill category before approving this challenge map.");
      if (status === "approved" && map?.submissionType === "challenge" && (!Number.isInteger(selectedLevel) || selectedLevel < 1 || selectedLevel > 20)) throw new Error("Challenge level must be between 1 and 20.");
      const response = await fetch(`/api/maps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: rejectNote || null, challengePlacement: selectedPlacement, challengeLevel: selectedPlacement ? selectedLevel : null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not review map.");
      setMaps((current) => current.filter((entry) => entry.id !== id));
      setRejectingId(null);
      setRejectNote("");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review map.");
    } finally {
      setBusyId("");
    }
  }

  if (maps.length === 0) return <div className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">There are no pending map submissions.</div>;

  return <div className="space-y-5">{error && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}{maps.map((map) => {
    const isRejecting = rejectingId === map.id;
    const challenge = map.submissionType === "challenge";
    const submitterName = map.submittedBy.displayName ?? map.submittedBy.username;
    const lengthLabel = map.length != null ? `${Math.floor(map.length / 60000)}:${String(Math.round((map.length % 60000) / 1000)).padStart(2, "0")}` : null;
    return <article key={map.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">{challenge ? <Swords size={18} /> : <Trophy size={18} />}</span><p className="text-xs uppercase tracking-[0.25em] text-accent">{challenge ? "Challenge submission" : "Ranked submission"}</p><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${challenge ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-accent/30 bg-accent/10 text-accent"}`}>{challenge ? "CHALLENGE" : "RANKED"}</span></div><h2 className="mt-3 text-2xl font-semibold text-white">{map.title}</h2><p className="mt-1 text-sm text-muted">{map.artist ?? "Unknown artist"} · Mapped by {map.mapperName ?? submitterName}</p><div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">{map.submittedBy.avatar ? <img src={map.submittedBy.avatar} alt={submitterName} className="h-9 w-9 rounded-full border border-accent/30" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent"><UserIcon size={16} /></span>}<div className="min-w-0"><p className="truncate text-sm font-semibold text-white">Submitted by <Link href={`/profile/${map.submittedBy.profileHandle}`} className="hover:text-accent">{submitterName}</Link></p><p className="text-xs text-muted">@{map.submittedBy.profileHandle} · {new Date(map.createdAt).toLocaleDateString()}</p></div></div><p className="mt-4 text-sm leading-7 text-muted">{map.description || "No description provided."}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">{challenge ? <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-semibold text-amber-200">No RHP · level progression only</span> : <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-semibold text-accent">Requested rating: {map.requestedRating.toFixed(2)}</span>}{map.noteCount != null && <span className="rounded-full border border-border bg-background/60 px-3 py-1">{map.noteCount.toLocaleString()} notes</span>}{lengthLabel && <span className="rounded-full border border-border bg-background/60 px-3 py-1">{lengthLabel}</span>}</div><div className="mt-5 flex flex-wrap gap-2"><a href={map.mapFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-white"><Download size={15} /> Map file</a>{map.sourceUrl && <a href={map.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white"><Link2 size={15} /> Rhythia</a>}</div></div><div>{map.imageUrl ? <img src={map.imageUrl} alt={map.title} className="aspect-video w-full rounded-2xl border border-border object-cover" /> : <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 text-sm text-muted">No thumbnail provided</div>}</div></div>{!isRejecting && challenge && <div className="mt-5 grid gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 sm:grid-cols-2"><div><label className="text-xs uppercase tracking-[0.2em] text-muted">Place in</label><select value={placement[map.id] ?? ""} onChange={(event) => setPlacement((current) => ({ ...current, [map.id]: event.target.value as PendingMap["challengePlacement"] }))} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white"><option value="">Choose destination</option>{placements.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="text-xs uppercase tracking-[0.2em] text-muted">Level</label><select value={level[map.id] ?? "1"} onChange={(event) => setLevel((current) => ({ ...current, [map.id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white">{Array.from({ length: 20 }, (_, index) => <option key={index + 1} value={index + 1}>Level {index + 1}</option>)}</select></div></div>}{isRejecting ? <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4"><p className="text-sm font-semibold text-white">Reason for rejection</p><textarea value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /><div className="mt-3 flex gap-2"><button disabled={busyId === map.id || !rejectNote.trim()} onClick={() => moderate(map.id, "rejected")} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === map.id ? "Rejecting..." : "Confirm rejection"}</button><button onClick={() => { setRejectingId(null); setRejectNote(""); }} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted">Cancel</button></div></div> : <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/40 p-4"><p className="text-sm text-muted">{challenge ? "Approval places this map in the selected challenge destination and level. No RHP is awarded." : "Approval adds this map to ranked maps and makes it eligible for RHP."}</p><div className="flex gap-2"><button disabled={busyId === map.id} onClick={() => moderate(map.id, "approved")} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === map.id ? "Approving..." : "Approve"}</button><button disabled={busyId === map.id} onClick={() => { setRejectNote(""); setRejectingId(map.id); }} className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-50">Reject</button></div></div>}</article>;
  })}</div>;
}
