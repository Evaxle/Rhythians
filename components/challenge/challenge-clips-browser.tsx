"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Clock3, MessageCircle, Send, ShieldX, Tag, Video } from "lucide-react";

type Comment = { id: string; userId: string; username: string; profileHandle: string; body: string; createdAt: string };
type Item = { id: string; kind: "challenge" | "category"; userId: string; username: string; profileHandle: string; category: string | null; level: number; mapName: string; status: string; reviewerNote: string | null; reviewerName: string | null; createdAt: string; videoUrl: string | null; comments: Comment[] };

function Status({ value }: { value: string }) {
  const styles = value === "approved" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : value === "rejected" ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200";
  const Icon = value === "approved" ? CheckCircle2 : value === "rejected" ? ShieldX : Clock3;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${styles}`}><Icon size={13} /> {value}</span>;
}

export function ChallengeClipsBrowser({ initialItems, signedIn }: { initialItems: Item[]; signedIn: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<Record<string, string>>({});

  async function submit(item: Item) {
    const body = drafts[item.id]?.trim();
    if (!body) return;
    setBusy(item.id);
    setError((current) => ({ ...current, [item.id]: "" }));
    try {
      const response = await fetch("/api/completion-clips/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: item.kind, clipId: item.id, body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to post comment.");
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, comments: [...entry.comments, data] } : entry));
      setDrafts((current) => ({ ...current, [item.id]: "" }));
    } catch (submitError) {
      setError((current) => ({ ...current, [item.id]: submitError instanceof Error ? submitError.message : "Unable to post comment." }));
    } finally { setBusy(""); }
  }

  if (items.length === 0) return <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-12 text-center text-sm text-muted">No completion clips match these filters.</div>;
  return <div className="grid gap-5">{items.map((item, index) => <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .04, .25) }} key={`${item.kind}-${item.id}`} className="ui-card overflow-hidden rounded-3xl"><div className="p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Status value={item.status} /><span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent"><Tag size={12} /> Challenge Map Submission</span><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted">{item.kind === "challenge" ? "Challenge" : item.category} · Level {item.level}</span></div><div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold text-white">{item.mapName}</h2><p className="mt-1 text-xs text-muted">Submitted by <Link href={`/profile/${item.profileHandle}`} className="font-semibold text-white hover:text-accent">{item.username}</Link> · {new Date(item.createdAt).toLocaleString()}</p></div>{item.reviewerName && <p className="text-xs text-muted">Reviewed by <span className="font-semibold text-white">{item.reviewerName}</span></p>}</div>{item.videoUrl ? <video className="mt-5 max-h-[620px] w-full rounded-2xl bg-black" controls preload="metadata" src={item.videoUrl} /> : <div className="mt-5 flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm text-muted"><Video size={18} className="mr-2" /> Video unavailable</div>}{item.reviewerNote && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Reviewer note</p><p className="mt-2 text-sm leading-6 text-white">{item.reviewerNote}</p></div>}<div className="mt-5 border-t border-white/10 pt-5"><div className="flex items-center gap-2"><MessageCircle size={15} className="text-accent" /><h3 className="text-sm font-semibold text-white">Comments</h3><span className="text-xs text-muted">{item.comments.length}</span></div><div className="mt-3 space-y-2">{item.comments.map((comment) => <div key={comment.id} className="rounded-2xl border border-white/10 bg-black/15 p-3"><div className="flex items-center justify-between gap-3"><Link href={`/profile/${comment.profileHandle}`} className="text-xs font-semibold text-white hover:text-accent">{comment.username}</Link><span className="text-[10px] text-muted">{new Date(comment.createdAt).toLocaleString()}</span></div><p className="mt-1 text-sm leading-5 text-muted">{comment.body}</p></div>)}{item.comments.length === 0 && <p className="text-xs text-muted">No comments yet.</p>}</div>{signedIn ? <div className="mt-3 flex gap-2"><input value={drafts[item.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" /><button type="button" onClick={() => void submit(item)} disabled={busy === item.id || !drafts[item.id]?.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50"><Send size={14} /> Send</button></div> : <p className="mt-3 text-xs text-muted">Sign in to comment.</p>}{error[item.id] && <p className="mt-2 text-xs text-red-300">{error[item.id]}</p>}</div></div></motion.article>)}</div>;
}
