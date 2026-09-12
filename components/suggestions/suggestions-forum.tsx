"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, MessageCircle, Plus, ThumbsUp } from "lucide-react";

type Comment = { id: string; body: string; createdAt: string; author: { username: string; displayName: string | null; profileHandle: string } };
type Suggestion = { id: string; title: string; body: string; category: string; status: string; createdAt: string; votes: number; comments: number; voted: boolean; author: { username: string; displayName: string | null; profileHandle: string } };
const categories = ["Website", "Maps & Ranking", "Challenges", "Battles & Tournaments", "Desktop & RhythKit", "Other"];

export function SuggestionsForum({ signedIn }: { signedIn: boolean }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [expanded, setExpanded] = useState("");
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/suggestions?sort=${sort}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setItems(Array.isArray(data.suggestions) ? data.suggestions : []);
  }, [sort]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setMessage("");
    const response = await fetch("/api/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body, category }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Could not post suggestion.");
    setTitle(""); setBody(""); setCategory(categories[0]); setCreating(false); setMessage("Suggestion posted."); await load();
  }

  async function vote(id: string) {
    const response = await fetch(`/api/suggestions/${id}/vote`, { method: "POST" });
    if (response.ok) await load();
  }

  async function openComments(id: string) {
    setExpanded(expanded === id ? "" : id);
    if (comments[id]) return;
    const response = await fetch(`/api/suggestions/${id}/comments`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setComments((v) => ({ ...v, [id]: data.comments ?? [] }));
  }

  async function addComment(id: string) {
    const response = await fetch(`/api/suggestions/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Could not add comment.");
    setComment(""); setComments((v) => ({ ...v, [id]: [...(v[id] ?? []), data.comment] })); await load();
  }

  return <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
    <section className="ui-page-header">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-accent"><Lightbulb size={15} /> Suggestions</p><h1 className="mt-2 text-3xl font-semibold text-white">Help shape Rhythians</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Post ideas for updates, maps and ranking, Challenges, battles, tournaments, RhythKit, and other parts of the project.</p></div>{signedIn ? <button type="button" onClick={() => setCreating((v) => !v)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white"><Plus size={16} /> New suggestion</button> : <Link href="/login" className="rounded-2xl bg-accent px-5 py-3 text-center text-sm font-bold text-white">Sign in to post</Link>}</div>
      {creating && <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4"><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-white/10 bg-[#101629] px-3 py-2.5 text-sm text-white">{categories.map((item) => <option key={item}>{item}</option>)}</select><input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Suggestion title" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-accent/40" /><textarea value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="Describe what should change and why." rows={5} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-accent/40" /><div className="flex justify-end"><button type="button" onClick={() => void create()} disabled={!title.trim() || !body.trim()} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">Post suggestion</button></div></div>}
      {message && <p className="mt-4 text-xs text-muted">{message}</p>}
    </section>

    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted">{items.length} suggestion{items.length === 1 ? "" : "s"}</p><select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "top")} className="rounded-xl border border-white/10 bg-[#101629] px-3 py-2 text-sm text-white"><option value="newest">Newest</option><option value="top">Top voted</option></select></div>
    <section className="space-y-3">{items.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-muted">No suggestions yet.</div> : items.map((item) => <article key={item.id} className="rounded-3xl border border-white/10 bg-surface/90 p-5 shadow-glow">
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="rounded-full border border-accent/25 bg-accent/[0.08] px-2.5 py-1 text-xs font-bold text-accent">{item.category}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted">{item.status}</span></div><h2 className="mt-3 text-xl font-bold text-white">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{item.body}</p><p className="mt-3 text-xs text-muted">by <Link href={`/profile/${item.author.profileHandle}`} className="text-white hover:text-accent">{item.author.displayName ?? item.author.username}</Link> · {new Date(item.createdAt).toLocaleDateString()}</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!signedIn} onClick={() => void vote(item.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${item.voted ? "border-accent/40 bg-accent/10 text-accent" : "border-white/10 text-muted"}`}><ThumbsUp size={13} /> {item.votes}</button><button type="button" onClick={() => void openComments(item.id)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-muted"><MessageCircle size={13} /> {item.comments}</button></div>
      {expanded === item.id && <div className="mt-4 border-t border-white/10 pt-4"><div className="space-y-2">{(comments[item.id] ?? []).map((entry) => <div key={entry.id} className="rounded-2xl bg-black/15 p-3"><p className="text-xs font-bold text-white">{entry.author.displayName ?? entry.author.username}</p><p className="mt-1 text-sm text-muted">{entry.body}</p></div>)}</div>{signedIn && <div className="mt-3 flex gap-2"><input value={comment} maxLength={1500} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" /><button type="button" onClick={() => void addComment(item.id)} disabled={!comment.trim()} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Reply</button></div>}</div>}
    </article>)}</section>
  </div>;
}
