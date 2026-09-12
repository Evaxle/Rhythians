"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar";
import { UserAvatar } from "@/components/user-avatar";

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  discordId: string | null;
};

export function TournamentSplitChat({ tournamentId }: { tournamentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [split, setSplit] = useState<"lower" | "higher" | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function load(silent = true) {
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/chat`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Chat unavailable.");
      setMessages(data.messages ?? []);
      setSplit(data.split ?? null);
      if (!silent) setError("");
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : "Chat unavailable.");
    }
  }

  useEffect(() => {
    void load(false);
    const timer = setInterval(() => void load(true), 3000);
    return () => clearInterval(timer);
  }, [tournamentId]);

  useEffect(() => bottomRef.current?.scrollIntoView({ block: "nearest" }), [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send message.");
      setContent("");
      setMessages(data.messages ?? []);
      setSplit(data.split ?? split);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-surface/95 shadow-glow">
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-accent"><MessageCircle size={14} /> {split ? `${split} split chat` : "Tournament chat"}</p><p className="mt-1 text-xs text-muted">Private to players in your tournament split.</p></div><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-xs text-muted">{messages.length} recent</span></div>
    <div className="h-[340px] space-y-3 overflow-y-auto p-4">
      {messages.length === 0 && <div className="flex h-full items-center justify-center text-center text-sm text-muted">No messages yet. Keep it friendly and help your split stay on schedule.</div>}
      {messages.map((message) => {
        const name = message.displayName ?? message.username;
        const avatar = getAvatarUrl(message, 64);
        return <div key={message.id} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-black/10 p-3"><UserAvatar src={avatar} username={message.username} displayName={name} className="h-9 w-9 rounded-xl object-cover" fallbackClassName="h-9 w-9 rounded-xl bg-white/5 text-xs font-black text-white" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2"><Link href={`/profile/${encodeURIComponent(message.profileHandle)}`} className="truncate text-xs font-bold text-white hover:text-accent">{name}</Link><span className="text-xs text-muted">{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-white/90">{message.content}</p></div></div>;
      })}
      <div ref={bottomRef} />
    </div>
    <form onSubmit={send} className="border-t border-white/10 p-4"><div className="flex gap-2"><input value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} placeholder="Message your split…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none focus:border-accent/40" /><button disabled={sending || !content.trim()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button></div>{error && <p className="mt-2 text-xs text-rose-300">{error}</p>}</form>
  </section>;
}
