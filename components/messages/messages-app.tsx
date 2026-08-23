"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, MessageCircle, MessageSquarePlus, MoreHorizontal, Plus, Reply, Search, Send, Trash2, UserPlus, Users, X } from "lucide-react";
import type { ConversationDetail, ConversationSummary, UserLite, MessageItem } from "@/components/messages/types";
import { userDisplayName, userAvatarUrl, getAvatarInitial } from "@/components/messages/types";
import { RichText } from "@/components/rich-text";

const POLL_INTERVAL = 3000;
const QUICK_REACTIONS = ["❤️", "👍", "😂", "🔥", "😮", "😢"];

type MessageReaction = { emoji: string; count: number; reacted: boolean };
type MessageFeatures = { reactions: Record<string, MessageReaction[]>; replies: Array<{ messageId: string; repliedToId: string }>; typing: Array<{ userId: string; username: string }> };

function Avatar({ user, size = "md" }: { user: Pick<UserLite, "avatar" | "discordId" | "username">; size?: "sm" | "md" | "lg" }) {
  const avatarUrl = userAvatarUrl(user);
  const dim = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  if (avatarUrl) return <img src={avatarUrl} alt={user.username} className={`${dim} rounded-full object-cover`} />;
  return <span className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white`}>{getAvatarInitial(user)}</span>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function conversationDisplayName(conversation: ConversationSummary) {
  return conversation.type === "group" ? conversation.name ?? "Group Chat" : userDisplayName(conversation.otherUsers[0] ?? { username: "Unknown", displayName: null });
}

function conversationDisplayUser(conversation: ConversationSummary) {
  return conversation.type === "group" ? null : conversation.otherUsers[0] ?? null;
}

export function MessagesApp({ currentUserId, initialTargetHandle, initialConversationId }: { currentUserId: string; initialTargetHandle?: string; initialConversationId?: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [features, setFeatures] = useState<MessageFeatures>({ reactions: {}, replies: [], typing: [] });
  const [friends, setFriends] = useState<UserLite[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Array<{ id: string; user: UserLite; createdAt: string }>>([]);
  const [searchResults, setSearchResults] = useState<UserLite[]>([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [error, setError] = useState("");
  const [reactionMenu, setReactionMenu] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    } catch {} finally { setLoadingConversations(false); }
  }, []);

  const loadFeatures = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}/features`, { cache: "no-store" });
      if (response.ok) setFeatures(await response.json());
    } catch {}
  }, []);

  const loadDetail = useCallback(async (conversationId: string, showLoading = true) => {
    setError("");
    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}`, { cache: "no-store" });
      if (!response.ok) { if (showLoading) setActiveId(null); return; }
      const data = await response.json();
      setDetail(data.conversation);
      setActiveId(conversationId);
      await loadFeatures(conversationId);
      if (showLoading) {
        await fetch(`/api/messages/conversations/${conversationId}/read`, { method: "POST" });
        setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
      }
    } catch { if (showLoading) setError("Could not load this conversation."); }
  }, [loadFeatures]);

  const openOrCreateDirect = useCallback(async (targetUser: UserLite) => {
    setComposing(true);
    setError("");
    try {
      const response = await fetch("/api/messages/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "direct", userId: targetUser.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start conversation.");
      setShowNewModal(false);
      await loadConversations();
      await loadDetail(data.conversationId);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not start conversation."); } finally { setComposing(false); }
  }, [loadConversations, loadDetail]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  useEffect(() => {
    loadConversations().then(() => {
      if (initialTargetHandle) {
        fetch(`/api/messages/users?q=${encodeURIComponent(initialTargetHandle)}`, { cache: "no-store" }).then((response) => response.json()).then((data) => {
          const target = data.users?.find((item: UserLite) => item.profileHandle.toLowerCase() === initialTargetHandle.toLowerCase());
          if (target) openOrCreateDirect(target);
        });
      } else if (initialConversationId) loadDetail(initialConversationId);
    });
  }, [loadConversations, loadDetail, openOrCreateDirect, initialTargetHandle, initialConversationId]);

  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(() => { loadDetail(activeId, false); }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [activeId, loadDetail]);

  useEffect(() => {
    if (!detail) return;
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
    else bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  async function searchFriends(query = friendQuery) {
    setSearchingFriends(true);
    try {
      const response = await fetch(`/api/messages/users?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = await response.json();
      setSearchResults(data.users ?? []);
    } catch { setSearchResults([]); } finally { setSearchingFriends(false); }
  }

  async function addFriend(userId: string) {
    const response = await fetch("/api/friends/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not send friend request."); return; }
    await loadFriends();
    setSearchResults((current) => current.filter((user) => user.id !== userId));
  }

  async function respondToRequest(requestId: string, action: "accept" | "decline") {
    const response = await fetch(`/api/friends/requests/${requestId}/${action}`, { method: "POST" });
    if (response.ok) { await loadFriends(); await loadConversations(); }
  }

  async function removeFriend(friendId: string) {
    const response = await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
    if (response.ok) setFriends((current) => current.filter((friend) => friend.id !== friendId));
  }

  async function deleteMessage(messageId: string) {
    if (!activeId) return;
    const response = await fetch(`/api/messages/conversations/${activeId}/messages/${messageId}`, { method: "DELETE" });
    if (response.ok) setDetail((current) => current ? { ...current, messages: current.messages.map((message) => message.id === messageId ? { ...message, isDeleted: true, content: "" } : message) } : current);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!activeId) return;
    const response = await fetch(`/api/messages/conversations/${activeId}/messages/${messageId}/reaction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) });
    if (response.ok) await loadFeatures(activeId);
    setReactionMenu(null);
  }

  async function sendMessage() {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    const content = draft.trim();
    try {
      const url = replyingTo ? `/api/messages/conversations/${activeId}/messages/${replyingTo.id}/reply` : `/api/messages/conversations/${activeId}/messages`;
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send message.");
      setDetail((current) => current ? { ...current, messages: [...current.messages, data.message] } : current);
      setDraft("");
      setReplyingTo(null);
      setError("");
      await fetch(`/api/messages/conversations/${activeId}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: false }) });
      await loadFeatures(activeId);
      await loadConversations();
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Could not send message."); } finally { setSending(false); }
  }

  async function setTyping(value: string) {
    setDraft(value);
    if (!activeId) return;
    await fetch(`/api/messages/conversations/${activeId}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: value.trim().length > 0 }) });
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => { fetch(`/api/messages/conversations/${activeId}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: false }) }); }, 3500);
  }

  const replyTargetMap = new Map(features.replies.map((reply) => [reply.messageId, reply.repliedToId]));
  const otherTyping = features.typing.filter((item) => item.userId !== currentUserId);

  return <div className="flex h-[calc(100vh-9rem)] min-h-[36rem] flex-col overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-glow">
    <div className="flex min-h-0 flex-1">
      <aside className={`w-full shrink-0 flex-col border-r border-border md:flex md:w-[25rem] lg:w-[29rem] ${activeId && detail ? "hidden" : "flex"}`}>
        <div className="border-b border-border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.22em] text-accent">Social</p><h1 className="mt-1 text-xl font-semibold text-white">Friends</h1></div><button type="button" onClick={() => { setShowFriendSearch(true); searchFriends(""); }} className="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-accent2"><UserPlus size={14} /> Find friends</button></div></div>
        <div className="flex-1 overflow-y-auto p-3">
          {incomingRequests.length > 0 && <section className="mb-5 rounded-2xl border border-accent/30 bg-accent/5 p-3"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Friend requests</p><div className="space-y-2">{incomingRequests.map((request) => <div key={request.id} className="flex items-center gap-2 rounded-xl bg-background/50 p-2"><Avatar user={request.user} size="sm" /><p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{userDisplayName(request.user)}</p><button type="button" onClick={() => respondToRequest(request.id, "accept")} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white"><Check size={13} /></button><button type="button" onClick={() => respondToRequest(request.id, "decline")} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-white"><X size={13} /></button></div>)}</div></section>}
          <section className="mb-5"><div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Friends</p><span className="text-xs text-muted">{friends.length}</span></div>{friends.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">No friends yet.<button type="button" onClick={() => { setShowFriendSearch(true); searchFriends(""); }} className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white"><UserPlus size={14} /> Find someone</button></div> : <div className="space-y-1">{friends.map((friend) => <div key={friend.id} className="group flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-white/5"><Link href={`/profile/${encodeURIComponent(friend.profileHandle)}`} className="shrink-0"><Avatar user={friend} size="sm" /></Link><Link href={`/profile/${encodeURIComponent(friend.profileHandle)}`} className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{userDisplayName(friend)}</p><p className="truncate text-xs text-muted">@{friend.profileHandle}</p></Link><button type="button" onClick={() => openOrCreateDirect(friend)} className="rounded-lg p-2 text-muted opacity-0 transition hover:bg-accent/10 hover:text-accent group-hover:opacity-100" aria-label={`Message ${friend.username}`}><MessageCircle size={16} /></button><button type="button" onClick={() => removeFriend(friend.id)} className="rounded-lg p-2 text-muted opacity-0 transition hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100" aria-label={`Remove ${friend.username}`}><X size={15} /></button></div>)}</div>}</section>
          <section><div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Chats</p><button type="button" onClick={() => setShowNewModal(true)} className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-white"><MessageSquarePlus size={16} /></button></div>{loadingConversations ? <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Loading chats...</div> : conversations.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">Your chats will appear here.</p> : <div className="space-y-1">{conversations.map((conversation) => { const displayUser = conversationDisplayUser(conversation); const active = conversation.id === activeId; return <button key={conversation.id} type="button" onClick={() => loadDetail(conversation.id)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${active ? "border-accent/40 bg-accent/10" : "border-transparent hover:border-border hover:bg-white/5"}`}>{displayUser ? <Avatar user={displayUser} /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent"><Users size={18} /></span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{conversationDisplayName(conversation)}</p><p className="truncate text-xs text-muted">{conversation.lastMessage?.isDeleted ? "Message deleted" : conversation.lastMessage?.content ?? "No messages yet"}</p></div>{conversation.unreadCount > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unreadCount}</span>}</button>; })}</div>}</section>
        </div>
      </aside>
      <section className={`min-w-0 flex-1 flex-col ${activeId && detail ? "flex" : "hidden md:flex"}`}>
        {activeId && detail ? <><header className="flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3.5"><button type="button" onClick={() => { setActiveId(null); setDetail(null); }} className="text-muted hover:text-white md:hidden"><ArrowLeft size={19} /></button>{detail.type === "group" ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent"><Users size={18} /></span> : <Avatar user={detail.otherUsers[0]} size="lg" />}<div className="min-w-0 flex-1">{detail.type === "group" ? <h2 className="truncate font-semibold text-white">{detail.name ?? "Group Chat"}</h2> : <Link href={`/profile/${encodeURIComponent(detail.otherUsers[0].profileHandle)}`} className="truncate font-semibold text-white hover:text-accent">{userDisplayName(detail.otherUsers[0])}</Link>}<p className="text-xs text-muted">{detail.type === "group" ? `${detail.members.length} members` : "Direct message"}</p></div><button type="button" className="rounded-xl p-2 text-muted hover:bg-white/5 hover:text-white"><MoreHorizontal size={19} /></button></header>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5"><div className="mx-auto max-w-4xl space-y-1">{detail.messages.map((message, index) => { const sender = detail.members.find((member) => member.id === message.senderId); const previous = detail.messages[index - 1]; const grouped = previous?.senderId === message.senderId && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 300000; const replyToId = replyTargetMap.get(message.id); const replyTarget = replyToId ? detail.messages.find((item) => item.id === replyToId) : null; const reactions = features.reactions[message.id] ?? []; return <div key={message.id} className={`group relative flex gap-3 rounded-xl px-2 py-1 hover:bg-white/[0.025] ${grouped ? "pt-0.5" : "mt-3 pt-2"}`}><div className="w-10 shrink-0">{!grouped && sender && <Link href={`/profile/${encodeURIComponent(sender.profileHandle)}`}><Avatar user={sender} size="md" /></Link>}</div><div className="min-w-0 flex-1"><div className="flex items-baseline gap-2">{!grouped && sender && <Link href={`/profile/${encodeURIComponent(sender.profileHandle)}`} className="font-semibold text-white hover:underline">{userDisplayName(sender)}</Link>}{!grouped && <span className="text-[10px] text-muted">{formatTime(message.createdAt)}</span>}</div><div className="relative"><div className="absolute -right-1 -top-7 hidden items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-xl group-hover:flex"><button type="button" onClick={() => setReplyingTo(message)} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-white" aria-label="Reply"><Reply size={14} /></button><button type="button" onClick={() => setReactionMenu(reactionMenu === message.id ? null : message.id)} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-white" aria-label="Add reaction">+</button>{message.senderId === currentUserId && <button type="button" onClick={() => deleteMessage(message.id)} className="rounded-lg p-1.5 text-muted hover:bg-red-400/10 hover:text-red-300" aria-label="Delete message"><Trash2 size={14} /></button>}</div>{reactionMenu === message.id && <div className="absolute -top-16 right-0 z-20 flex gap-1 rounded-2xl border border-border bg-surface p-2 shadow-2xl">{QUICK_REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => toggleReaction(message.id, emoji)} className="rounded-lg px-2 py-1 text-lg hover:bg-white/10">{emoji}</button>)}</div>}{replyTarget && <button type="button" onClick={() => document.getElementById(`message-${replyTarget.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mb-1 flex max-w-xl items-center gap-2 rounded-lg border-l-2 border-accent bg-white/[0.03] px-2 py-1 text-left text-xs text-muted hover:bg-white/[0.06]"><Reply size={12} className="text-accent" /><span className="truncate">Replying to {detail.members.find((member) => member.id === replyTarget.senderId)?.username ?? "user"}: {replyTarget.content}</span></button>}<div id={`message-${message.id}`} className={`text-[15px] leading-6 ${message.isDeleted ? "italic text-muted" : "text-white"}`}>{message.isDeleted ? "Message deleted" : <RichText content={message.content} />}{message.isEdited && !message.isDeleted && <span className="ml-1 text-[10px] text-muted">(edited)</span>}</div>{reactions.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => toggleReaction(message.id, reaction.emoji)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${reaction.reacted ? "border-accent/60 bg-accent/15 text-white" : "border-border bg-white/5 text-muted hover:border-accent/30 hover:text-white"}`}>{reaction.emoji} <span>{reaction.count}</span></button>)}</div>}</div></div></div>; })}<div ref={bottomRef} /></div></div>
          {otherTyping.length > 0 && <div className="px-6 pb-2 text-xs text-muted"><span className="mr-1 inline-flex gap-0.5"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" /></span>{otherTyping.length === 1 ? `${otherTyping[0].username} is typing...` : `${otherTyping.length} people are typing...`}</div>}
          {replyingTo && <div className="mx-4 flex items-center gap-3 rounded-t-2xl border border-border bg-background/70 px-4 py-2 text-xs"><Reply size={14} className="text-accent" /><span className="min-w-0 flex-1 truncate text-muted">Replying to <span className="font-semibold text-white">{detail.members.find((member) => member.id === replyingTo.senderId)?.username ?? "user"}</span>: {replyingTo.content}</span><button type="button" onClick={() => setReplyingTo(null)} className="text-muted hover:text-white"><X size={15} /></button></div>}
          {error && <p className="border-t border-border px-5 py-2 text-sm text-red-300">{error}</p>}
          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="border-t border-border p-4"><div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-border bg-background/80 p-2 focus-within:border-accent/50"><textarea value={draft} onChange={(event) => setTyping(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={`Message ${detail.type === "group" ? detail.name ?? "the group" : userDisplayName(detail.otherUsers[0])}`} rows={1} className="min-h-10 max-h-36 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-muted" /><button type="submit" disabled={sending || !draft.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent2 disabled:opacity-40"><Send size={17} /></button></div></form></> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 text-accent"><MessageCircle size={28} /></div><h2 className="mt-5 text-xl font-semibold text-white">Your messages</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted">Choose a chat from your friends or start a new conversation. Replies, reactions, typing indicators, and profile links are built into the chat.</p><button type="button" onClick={() => { setShowFriendSearch(true); searchFriends(""); }} className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white"><UserPlus size={15} /> Find friends</button></div>}
      </section>
    </div>

    {showFriendSearch && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-3xl border border-border bg-surface p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-accent">People</p><h2 className="mt-1 text-xl font-semibold text-white">Find friends</h2></div><button type="button" onClick={() => setShowFriendSearch(false)} className="rounded-xl p-2 text-muted hover:bg-white/5 hover:text-white"><X size={18} /></button></div><form onSubmit={(event) => { event.preventDefault(); searchFriends(); }} className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3"><Search size={17} className="text-muted" /><input autoFocus value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)} placeholder="Search username, display name, or profile handle..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /><button type="submit" className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white">Search</button></form><div className="mt-5 max-h-[55vh] space-y-2 overflow-y-auto">{searchingFriends ? <div className="flex justify-center p-8 text-muted"><Loader2 size={20} className="animate-spin" /></div> : searchResults.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">Search for a user to send a friend request.</div> : searchResults.map((result) => { const isFriend = friends.some((friend) => friend.id === result.id); return <div key={result.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-3"><Link href={`/profile/${encodeURIComponent(result.profileHandle)}`} onClick={() => setShowFriendSearch(false)}><Avatar user={result} /></Link><Link href={`/profile/${encodeURIComponent(result.profileHandle)}`} onClick={() => setShowFriendSearch(false)} className="min-w-0 flex-1"><p className="truncate font-semibold text-white hover:text-accent">{userDisplayName(result)}</p><p className="truncate text-xs text-muted">@{result.profileHandle}</p></Link>{isFriend ? <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">Friends</span> : <button type="button" onClick={() => addFriend(result.id)} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white"><Plus size={14} /> Add friend</button>}<button type="button" onClick={() => openOrCreateDirect(result)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white">Message</button></div>; })}</div></div></div>}
    {showNewModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-accent">Chat</p><h2 className="mt-1 text-xl font-semibold text-white">New message</h2></div><button type="button" onClick={() => setShowNewModal(false)} className="rounded-xl p-2 text-muted hover:bg-white/5 hover:text-white"><X size={18} /></button></div><div className="mt-5 space-y-2">{friends.map((friend) => <button key={friend.id} type="button" disabled={composing} onClick={() => openOrCreateDirect(friend)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background/50 p-3 text-left hover:bg-white/5 disabled:opacity-50"><Avatar user={friend} /><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{userDisplayName(friend)}</span><span className="block truncate text-xs text-muted">@{friend.profileHandle}</span></span><Send size={16} className="text-accent" /></button>)}{friends.length === 0 && <p className="p-6 text-center text-sm text-muted">Add friends first, then start a conversation here.</p>}</div></div></div>}
  </div>;
}
