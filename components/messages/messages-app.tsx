"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Search, Send, Users, Plus, X, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import type { ConversationSummary, ConversationDetail, UserLite } from "@/components/messages/types";
import { userDisplayName, userAvatarUrl, getAvatarInitial } from "@/components/messages/types";
import { RichText } from "@/components/rich-text";

const POLL_INTERVAL = 4000;

function Avatar({ user, size = "md" }: { user: Pick<UserLite, "avatar" | "discordId" | "username">; size?: "sm" | "md" }) {
  const avatarUrl = userAvatarUrl(user);
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  if (avatarUrl) return <img src={avatarUrl} alt={user.username} className={`${dim} rounded-full object-cover`} />;
  return <span className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white`}>{getAvatarInitial(user)}</span>;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function conversationDisplayName(conversation: ConversationSummary) {
  return conversation.type === "group" ? conversation.name ?? "Group Chat" : conversation.otherUsers[0]?.username ?? "Unknown";
}

function conversationDisplayUser(conversation: ConversationSummary) {
  return conversation.type === "group" ? null : conversation.otherUsers[0] ?? null;
}

export function MessagesApp({ currentUserId, initialTargetHandle, initialConversationId }: { currentUserId: string; initialTargetHandle?: string; initialConversationId?: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null);
  const [friends, setFriends] = useState<UserLite[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Array<{ id: string; user: UserLite; createdAt: string }>>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      const response = await fetch("/api/friends", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setFriends(data.friends ?? []);
      setIncomingRequests(data.incoming ?? []);
    } catch {}
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/conversations", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setConversations(data.conversations ?? []);
    } catch {} finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  async function respondToRequest(requestId: string, action: "accept" | "decline") {
    try {
      const response = await fetch(`/api/friends/requests/${requestId}/${action}`, { method: "POST" });
      if (!response.ok) return;
      setIncomingRequests((current) => current.filter((r) => r.id !== requestId));
      await loadFriends();
      await loadConversations();
    } catch {}
  }

  async function removeFriend(friendId: string) {
    try {
      const response = await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
      if (!response.ok) return;
      setFriends((current) => current.filter((f) => f.id !== friendId));
    } catch {}
  }

  async function deleteMessage(messageId: string) {
    if (!activeId) return;
    try {
      const response = await fetch(`/api/messages/conversations/${activeId}/messages/${messageId}`, { method: "DELETE" });
      if (!response.ok) return;
      setDetail((current) => current ? { ...current, messages: current.messages.map((m) => m.id === messageId ? { ...m, isDeleted: true, content: "" } : m) } : current);
    } catch {}
  }

  const loadDetail = useCallback(async (conversationId: string, showLoading = true) => {
    if (showLoading) setLoadingDetail(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}`, { cache: "no-store" });
      if (!response.ok) {
        if (showLoading) {
          setError("Could not load this conversation.");
          setActiveId(null);
        }
        return;
      }
      const data = await response.json();
      const nextDetail = data.conversation;
      setDetail((current) => {
        if (!current || current.id !== nextDetail.id) return nextDetail;
        if (current.messages.length === nextDetail.messages.length && current.messages.every((message, index) => message.id === nextDetail.messages[index]?.id && message.content === nextDetail.messages[index]?.content && message.isDeleted === nextDetail.messages[index]?.isDeleted)) return current;
        return nextDetail;
      });
      setActiveId(conversationId);
      if (showLoading) {
        await fetch(`/api/messages/conversations/${conversationId}/read`, { method: "POST" });
        setConversations((current) => current.map((c) => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
      }
    } catch {
      if (showLoading) setError("Could not load this conversation.");
    } finally {
      if (showLoading) setLoadingDetail(false);
    }
  }, []);

  const openOrCreateDirect = useCallback(async (targetUser: UserLite) => {
    setComposing(true);
    setError("");
    try {
      const response = await fetch("/api/messages/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "direct", userId: targetUser.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start conversation.");
      await loadConversations();
      await loadDetail(data.conversationId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not start conversation.");
    } finally {
      setComposing(false);
    }
  }, [loadConversations, loadDetail]);

  const resolveInitialTarget = useCallback(async (handle: string) => {
    const response = await fetch(`/api/messages/users?q=${encodeURIComponent(handle)}`, { cache: "no-store" });
    const data = await response.json();
    const target = data.users?.find((u: UserLite) => u.profileHandle.toLowerCase() === handle.toLowerCase());
    if (target) await openOrCreateDirect(target);
  }, [openOrCreateDirect]);

  useEffect(() => {
    loadConversations().then(() => {
      if (initialTargetHandle) return resolveInitialTarget(initialTargetHandle);
      if (initialConversationId) return loadDetail(initialConversationId);
      return undefined;
    });
  }, [loadConversations, resolveInitialTarget, loadDetail, initialTargetHandle, initialConversationId]);

  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(() => {
      loadDetail(activeId, false);
      loadConversations();
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [activeId, loadDetail, loadConversations]);

  useEffect(() => {
    if (!detail) return;
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
    else bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  async function sendMessage() {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    const content = draft;
    try {
      const response = await fetch(`/api/messages/conversations/${activeId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send message.");
      setDetail((current) => current ? { ...current, messages: [...current.messages, data.message] } : current);
      setDraft("");
      setError("");
      await loadConversations();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[32rem] flex-col overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-glow">
      <div className="flex flex-1 min-h-0">
        <aside className={`w-full flex-col border-r border-border md:flex md:w-80 lg:w-96 ${activeId && detail ? "hidden" : "flex"}`}>
          <div className="flex items-center justify-between gap-2 border-b border-border p-4"><div className="flex items-center gap-2"><Users size={18} className="text-accent" /><h1 className="text-lg font-semibold text-white">Messages</h1></div><button type="button" onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent2"><MessageSquarePlus size={15} /> New</button></div>
          <div className="flex-1 overflow-y-auto p-2">
            {incomingRequests.length > 0 && <div className="mb-3 rounded-2xl border border-accent/30 bg-accent/5 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Friend requests ({incomingRequests.length})</p><div className="space-y-2">{incomingRequests.map((request) => <div key={request.id} className="flex items-center gap-2"><Avatar user={request.user} size="sm" /><p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{request.user.username}</p><button type="button" onClick={() => respondToRequest(request.id, "accept")} className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent2">Accept</button><button type="button" onClick={() => respondToRequest(request.id, "decline")} className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs font-semibold text-muted transition hover:text-white">Decline</button></div>)}</div></div>}
            {friends.length > 0 && <div className="mb-3"><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">Friends ({friends.length})</p><div className="space-y-1">{friends.map((friend) => <div key={friend.id} className="flex items-center gap-2 rounded-2xl px-2 py-1.5 transition hover:bg-white/5"><Avatar user={friend} size="sm" /><p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{friend.username}</p><button type="button" onClick={() => openOrCreateDirect(friend)} disabled={composing} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"><Send size={11} /> Message</button><button type="button" onClick={() => removeFriend(friend.id)} className="rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-red-400/40 hover:text-red-300">Remove</button></div>)}</div></div>}
            {loadingConversations ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Loading conversations...</div> : conversations.length === 0 ? <div className="p-8 text-center text-sm text-muted"><p>No conversations yet.</p><button type="button" onClick={() => setShowNewModal(true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"><MessageSquarePlus size={15} /> Start a message</button></div> : conversations.map((conversation) => { const displayUser = conversationDisplayUser(conversation); const active = conversation.id === activeId; return <button key={conversation.id} type="button" onClick={() => loadDetail(conversation.id)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${active ? "border-accent/40 bg-white/5" : "border-transparent hover:border-border hover:bg-white/5"}`}>{conversation.type === "group" ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"><Users size={18} /></span> : displayUser ? <Avatar user={displayUser} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"><Users size={18} /></span>}<div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-sm font-semibold text-white">{conversationDisplayName(conversation)}</p>{conversation.lastMessage && <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">{formatTime(conversation.lastMessage.createdAt)}</span>}</div><div className="flex items-center justify-between gap-2"><p className="truncate text-xs text-muted">{conversation.lastMessage ? conversation.lastMessage.isDeleted ? "Message deleted" : conversation.lastMessage.content : "No messages yet"}</p>{conversation.unreadCount > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{conversation.unreadCount}</span>}</div></div></button>; })}
          </div>
        </aside>
        <section className={`flex-1 flex-col min-w-0 md:flex ${activeId && detail ? "flex" : "hidden"}`}>
          {activeId && detail ? <><header className="flex items-center gap-3 border-b border-border p-4"><button type="button" onClick={() => { setActiveId(null); setDetail(null); }} className="text-muted transition hover:text-white md:hidden" aria-label="Back to conversations"><ArrowLeft size={18} /></button>{detail.type === "group" ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"><Users size={18} /></span> : <Avatar user={detail.otherUsers[0]} />}<div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-white">{detail.type === "group" ? detail.name ?? "Group Chat" : userDisplayName(detail.otherUsers[0])}</h2></div></header><div ref={scrollRef} className="flex-1 overflow-y-auto p-4"><div className="mx-auto max-w-3xl space-y-3">{detail.messages.map((message) => <div key={message.id} className={`flex ${message.senderId === currentUserId ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${message.senderId === currentUserId ? "bg-accent text-white" : "bg-white/5 text-white"}`}>{message.isDeleted ? <span className="italic text-muted">Message deleted</span> : <RichText content={message.content} />}</div>{message.senderId === currentUserId && !message.isDeleted && <button type="button" onClick={() => deleteMessage(message.id)} className="ml-2 self-center text-muted hover:text-red-300" aria-label="Delete message"><Trash2 size={14} /></button>}</div>)}<div ref={bottomRef} /></div></div>{error && <p className="border-t border-border px-4 py-2 text-sm text-red-300">{error}</p>}<form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="border-t border-border p-4"><div className="mx-auto flex max-w-3xl items-end gap-2"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Write a message..." rows={1} className="min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" /><button type="submit" disabled={sending || !draft.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent2 disabled:opacity-50"><Send size={17} /></button></div></form></> : <div className="flex flex-1 items-center justify-center text-sm text-muted">Select a conversation to start chatting.</div>}
        </section>
      </div>
      {showNewModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-white">New message</h2><button type="button" onClick={() => setShowNewModal(false)} className="text-muted hover:text-white"><X size={18} /></button></div><div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2"><Search size={16} className="text-muted" /><input placeholder="Search users..." className="w-full bg-transparent text-sm text-white outline-none" /></div><div className="mt-6 text-sm text-muted">Select a friend above to start a conversation.</div></div></div>}
    </div>
  );
}
