"use client";

import { useEffect, useState } from "react";

interface Item { id: string; userId: string; username: string; category?: string; level: number; mapName: string; videoUrl: string | null; createdAt: string }

export default function CompletionClipReviewPage() {
  const [category, setCategory] = useState<Item[]>([]);
  const [challenge, setChallenge] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/admin/completion-clips", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Could not load completion clips.");
    setCategory(data.category ?? []);
    setChallenge(data.challenge ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function review(kind: "category" | "challenge", id: string, decision: "approved" | "rejected") {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/admin/completion-clips", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Review failed.");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review failed.");
    } finally {
      setBusy("");
    }
  }

  const render = (items: Item[], kind: "category" | "challenge") => items.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">No pending completion clips.</p> : <div className="grid gap-5">{items.map((item) => <article key={item.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{kind === "challenge" ? "Challenge" : item.category}</span><span className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs text-muted">Level {item.level}</span><span className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs text-muted">{item.username}</span></div><h2 className="mt-3 text-xl font-semibold text-white">{item.mapName}</h2><p className="mt-1 text-xs text-muted">Uploaded {new Date(item.createdAt).toLocaleString()}</p>{item.videoUrl ? <video className="mt-5 max-h-[560px] w-full rounded-2xl bg-black" controls src={item.videoUrl} /> : <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">Video is unavailable.</p>}<div className="mt-5 flex gap-3"><button disabled={busy === item.id} onClick={() => void review(kind, item.id, "approved")} className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Approve completion</button><button disabled={busy === item.id} onClick={() => void review(kind, item.id, "rejected")} className="rounded-full border border-red-400/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-50">Reject</button></div></article>)}</div>;

  return <div className="space-y-8"><section><p className="text-sm uppercase tracking-[0.3em] text-accent">Completion review</p><h1 className="mt-2 text-3xl font-semibold text-white">Clip reviewers</h1><p className="mt-3 text-sm text-muted">Review Level 7-10 completion proof. Approving a valid clip awards that level only when the user is still exactly one level below it.</p></section>{error && <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}<section><h2 className="mb-4 text-xl font-semibold text-white">Category completions</h2>{render(category, "category")}</section><section><h2 className="mb-4 text-xl font-semibold text-white">Challenge completions</h2>{render(challenge, "challenge")}</section></div>;
}
