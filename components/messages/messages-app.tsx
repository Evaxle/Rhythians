"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Search, Send, Users, Plus, X, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import type {
  ConversationSummary,
  ConversationDetail,
  UserLite,
} from "@/components/messages/types";
import {
  userDisplayName,
  userAvatarUrl,
  getAvatarInitial,
} from "@/components/messages/types";
import { RichText } from "@/components/rich-text";

const POLL_INTERVAL = 4000;

function Avatar({
  user,
  size = "md",
}: {
  user: Pick<UserLite, "avatar" | "discordId" | "username">;
  size?: "sm" | "md";
}) {
  const avatarUrl = userAvatarUrl(user);
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  if (avatarUrl) {
    return <img src={avatarUrl} alt={user.username} className={`${dim} rounded-full object-cover`} />;
  }
  return (
    <span className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white`}>
      {getAvatarInitial(user)}
    </span>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function conversationDisplayName(conversation: ConversationSummary) {
  if (conversation.type === "group") {
    return conversation.name ?? "Group Chat";
  }
  return conversation.otherUsers[0]?.username ?? "Unknown";
}

function conversationDisplayUser(conversation: ConversationSummary) {
  return conversation.type === "group" ? null : (conversation.otherUsers[0] ?? null);
}

export function MessagesApp({
  currentUserId,
  initialTargetHandle,
  initialConversationId,
}: {
  currentUserId: string;
  initialTargetHandle?: string;
  initialConversationId?: string;
}) {
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
    } catch {
      // Ignore transient failures.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respondToRequest(requestId: string, action: "accept" | "decline") {
    try {
      const response = await fetch(`/api/friends/requests/${requestId}/${action}`, { method: "POST" });
      if (!response.ok) return;
      setIncomingRequests((current) => current.filter((r) => r.id !== requestId));
      await loadFriends();
      await loadConversations();
    } catch {
      // Ignore transient failures.
    }
  }

  async function removeFriend(friendId: string) {
    try {
      const response = await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
      if (!response.ok) return;
      setFriends((current) => current.filter((f) => f.id !== friendId));
    } catch {
      // Ignore transient failures.
    }
  }

  async function deleteMessage(messageId: string) {
    if (!activeId) return;
    try {
      const response = await fetch(`/api/messages/conversations/${activeId}/messages/${messageId}`, { method: "DELETE" });
      if (!response.ok) return;
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: "" } : m)),
            }
          : current,
      );
    } catch {
      // Ignore transient failures.
    }
  }

  Conversations = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/conversations", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setConversations(data.conversations);
    } catch {
      // Ignore transient polling errors.
    } finally {
      setLoadingConversations(false);
    }
  }, []);

 const loadDetail = useCallback(async (conversationId: string, showLoading = true) => {
  if (showLoading) {
    setLoadingDetail(true);
  }

  setError("");

  try {
    const response = await fetch(`/api/messages/conversations/${conversationId}`, {
      cache: "no-store",
    });

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
      if (!current || current.id !== nextDetail.id) {
        return nextDetail;
      }

      if (
        current.messages.length === nextDetail.messages.length &&
        current.messages.every(
          (message, index) => message.id === nextDetail.messages[index]?.id &&
            message.content === nextDetail.messages[index]?.content &&
            message.isDeleted === nextDetail.messages[index]?.isDeleted
        )
      ) {
        return current;
      }

      return nextDetail;
    });

    setActiveId(conversationId);

    if (showLoading) {
      await fetch(`/api/messages/conversations/${conversationId}/read`, {
        method: "POST",
      });

      setConversations((current) =>
        current.map((c) =>
          c.id === conversationId
            ? { ...c, unreadCount: 0 }
            : c
        )
      );
    }
  } catch {
    if (showLoading) {
      setError("Could not load this conversation.");
    }
  } finally {
    if (showLoading) {
      setLoadingDetail(false);
    }
  }
}, []);
  
  const openOrCreateDirect = useCallback(
    async (targetUser: UserLite) => {
      setComposing(true);
      setError("");
      try {
        const response = await fetch("/api/messages/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "direct", userId: targetUser.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not start conversation.");
        await loadConversations();
        await loadDetail(data.conversationId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not start conversation.");
      } finally {
        setComposing(false);
      }
    },
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    [loadConversations, loadDetail],
  );

  const resolveInitialTarget = useCallback(
    async (handle: string) => {
      const response = await fetch(`/api/messages/users?q=${encodeURIComponent(handle)}`, { cache: "no-store" });
      const data = await response.json();
      const target = data.users?.find((u: UserLite) => u.profileHandle.toLowerCase() === handle.toLowerCase());
      if (target) {
        await openOrCreateDirect(target);
      }
    },
    [openOrCreateDirect],
  );

  useEffect(() => {
    loadConversations().then(() => {
      if (initialTargetHandle) {
        return resolveInitialTarget(initialTargetHandle);
      }
      if (initialConversationId) {
        return loadDetail(initialConversationId);
      }
      return undefined;
    });
  }, []);

 useEffect(() => {
  if (!activeId) return;

  const timer = setInterval(() => {
    loadDetail(activeId, false);
    loadConversations();
  }, POLL_INTERVAL);

  return () => clearInterval(timer);
}, [activeId, loadDetail, loadConversations]);

  useEffect(() => {
    if (detail) {
      const container = scrollRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [detail?.messages.length]);

  async function sendMessage() {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    const content = draft;
    try {
      const response = await fetch(`/api/messages/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send message.");
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: [...current.messages, data.message],
            }
          : current,
      );
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
        {/* Conversation list */}
        <aside className={`w-full flex-col border-r border-border md:flex md:w-80 lg:w-96 ${activeId && detail ? "hidden" : "flex"}`}>
          <div className="flex items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-accent" />
              <h1 className="text-lg font-semibold text-white">Messages</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent2"
            >
              <MessageSquarePlus size={15} /> New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {incomingRequests.length > 0 && (
              <div className="mb-3 rounded-2xl border border-accent/30 bg-accent/5 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  Friend requests ({incomingRequests.length})
                </p>
                <div className="space-y-2">
                  {incomingRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-2">
                      <Avatar user={request.user} size="sm" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                        {request.user.username}
                      </p>
                      <button
                        type="button"
                        onClick={() => respondToRequest(request.id, "accept")}
                        className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent2"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => respondToRequest(request.id, "decline")}
                        className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs font-semibold text-muted transition hover:text-white"
                      >
                        Decline
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {friends.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  Friends ({friends.length})
                </p>
                <div className="space-y-1">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-2 rounded-2xl px-2 py-1.5 transition hover:bg-white/5">
                      <Avatar user={friend} size="sm" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{friend.username}</p>
                      <button
                        type="button"
                        onClick={() => openOrCreateDirect(friend)}
                        disabled={composing}
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
                        title={`Message ${friend.username}`}
                      >
                        <Send size={11} /> Message
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFriend(friend.id)}
                        className="rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-red-400/40 hover:text-red-300"
                        title="Remove friend"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingConversations ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" /> Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                <p>No conversations yet.</p>
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"
                >
                  <MessageSquarePlus size={15} /> Start a message
                </button>
              </div>
            ) : (
              conversations.map((conversation) => {
                const displayUser = conversationDisplayUser(conversation);
                const active = conversation.id === activeId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => loadDetail(conversation.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-accent/40 bg-white/5"
                        : "border-transparent hover:border-border hover:bg-white/5"
                    }`}
                  >
                    {conversation.type === "group" ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                        <Users size={18} />
                      </span>
                    ) : displayUser ? (
                      <Avatar user={displayUser} />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                        <Users size={18} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {conversationDisplayName(conversation)}
                        </p>
                        {conversation.lastMessage && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">
                            {formatTime(conversation.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted">
                          {conversation.lastMessage
                            ? conversation.lastMessage.isDeleted
                              ? "Message deleted"
                              : conversation.lastMessage.content
                            : "No messages yet"}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat window */}
        <section className={`flex-1 flex-col min-w-0 md:flex ${activeId && detail ? "flex" : "hidden"}`}>
          {activeId && detail ? (
            <>
              <header className="flex items-center gap-3 border-b border-border p-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(null);
                    setDetail(null);
                  }}
                  className="text-muted transition hover:text-white md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                {detail.type === "group" ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <Users size={18} />
                  </span>
                ) : (
                  (() => {
                    const other = detail.members.find((m) => m.id !== currentUserId);
                    return other ? <Avatar user={other} /> : null;
                  })()
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {detail.type === "group"
                      ? (detail.name ?? "Group Chat")
                      : (detail.members.find((m) => m.id !== currentUserId)?.username ?? "Chat")}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {detail.type === "group"
                      ? `${detail.members.length} members`
                      : `@${detail.members.find((m) => m.id !== currentUserId)?.profileHandle ?? ""}`}
                  </p>
                </div>
                {detail.type === "group" && (
                  <button
                    type="button"
                    onClick={() => setAddToGroupId(detail.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-white"
                    title="Add members"
                  >
                    <Plus size={14} /> Add
                  </button>
                )}
              </header>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
                {loadingDetail ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted">
                    <Loader2 size={16} className="animate-spin" /> Loading messages...
                  </div>
                ) : detail.messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  <div className="space-y-1">
                    {detail.messages.map((message) => {
                      const mine = message.senderId === currentUserId;
                      const sender = detail.members.find((m) => m.id === message.senderId);
                      return (
                        <div
                          key={message.id}
                          className={`group flex w-full ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`flex max-w-[78%] items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                            {!mine && detail.type === "group" && sender && (
                              <Avatar user={sender} size="sm" />
                            )}
                            <div
                              className={`rounded-3xl px-4 py-2.5 text-sm leading-6 ${
                                mine
                                  ? "rounded-br-md bg-accent text-white"
                                  : "rounded-bl-md border border-border bg-background/70 text-white"
                              }`}
                            >
                              {!mine && detail.type === "group" && sender && (
                                <p className="mb-1 text-xs font-semibold text-accent">{sender.username}</p>
                              )}
                              {message.isDeleted ? (
                                <p className="italic opacity-70">This message was deleted.</p>
                              ) : (
                                <RichText text={message.content} />
                              )}
                              <p className={`mt-1 text-[10px] uppercase tracking-wider ${mine ? "text-white/60" : "text-muted"}`}>
                                {formatTime(message.createdAt)}
                                {message.isEdited && !message.isDeleted ? " · edited" : ""}
                              </p>
                            </div>
                            {mine && !message.isDeleted && (
                              <button
                                type="button"
                                onClick={() => deleteMessage(message.id)}
                                className="mb-1 hidden shrink-0 items-center justify-center rounded-full border border-border bg-background/70 p-2 text-muted transition hover:border-red-400/40 hover:text-red-300 group-hover:flex"
                                aria-label="Delete message"
                                title="Delete message"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-border p-3">
                {error && <p className="mb-2 px-2 text-xs text-red-300">{error}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        if (event.shiftKey) return;
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                    className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-background/70 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent/60"
                  />
                  <button
                    type="button"
                    disabled={sending || !draft.trim()}
                    onClick={sendMessage}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/15 text-accent">
                <MessageSquarePlus size={28} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">
                {composing ? "Starting a conversation..." : "Select a conversation"}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                Choose a conversation from the list or start a new one with another member of the community.
              </p>
              {!composing && (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"
                >
                  <MessageSquarePlus size={16} /> New message
                </button>
              )}
              {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            </div>
          )}
        </section>
      </div>

      {showNewModal && (
        <NewConversationModal
          currentUserId={currentUserId}
          onClose={() => setShowNewModal(false)}
          onCreated={(conversationId) => {
            setShowNewModal(false);
            loadConversations();
            loadDetail(conversationId);
          }}
        />
      )}

      {addToGroupId && (
        <AddMembersModal
          currentUserId={currentUserId}
          conversationId={addToGroupId}
          onClose={() => setAddToGroupId(null)}
          onAdded={() => {
            setAddToGroupId(null);
            loadDetail(addToGroupId);
            loadConversations();
          }}
        />
      )}
    </div>
  );
}

function NewConversationModal({
  currentUserId,
  onClose,
  onCreated,
}: {
  currentUserId: string;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [selected, setSelected] = useState<UserLite[]>([]);
  const [groupName, setGroupName] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/messages/users?q=${encodeURIComponent(query)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => setResults(data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [query]);

  function toggleUser(user: UserLite) {
    setSelected((current) =>
      current.some((u) => u.id === user.id)
        ? current.filter((u) => u.id !== user.id)
        : [...current, user],
    );
  }

  async function submit() {
    setError("");
    if (mode === "direct") {
      const target = selected[0];
      if (!target) {
        setError("Select a user to message.");
        return;
      }
      setSubmitting(true);
      try {
        const response = await fetch("/api/messages/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "direct", userId: target.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not start conversation.");
        onCreated(data.conversationId);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not start conversation.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!groupName.trim()) {
      setError("Give your group a name.");
      return;
    }
    if (selected.length === 0) {
      setError("Add at least one member.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group",
          name: groupName.trim(),
          memberIds: selected.map((u) => u.id),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create group.");
      onCreated(data.conversationId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create group.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New conversation</h2>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("direct")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "direct" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"
            }`}
          >
            Direct message
          </button>
          <button
            type="button"
            onClick={() => setMode("group")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "group" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"
            }`}
          >
            Group chat
          </button>
        </div>

        {mode === "group" && (
          <div className="mt-4">
            <label htmlFor="group-name" className="sr-only">Group name</label>
            <input
              id="group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              maxLength={60}
              placeholder="Group name"
              className="w-full rounded-2xl border border-border bg-background/70 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent/60"
            />
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-3 py-2">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === "group" ? "Search members to add..." : "Search for a user..."}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted"
          />
        </div>

        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUser(user)}
                className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-accent"
              >
                {userDisplayName(user)}
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
          {searching ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Searching...
            </p>
          ) : (
            results
              .filter((user) => user.id !== currentUserId)
              .map((user) => {
                const isSelected = selected.some((u) => u.id === user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                      isSelected
                        ? "border-accent/40 bg-accent/10"
                        : "border-transparent hover:border-border hover:bg-white/5"
                    }`}
                  >
                    <Avatar user={user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{userDisplayName(user)}</p>
                      <p className="truncate text-xs text-muted">@{user.profileHandle}</p>
                    </div>
                    {mode === "direct" ? (
                      <span className="text-xs text-muted">Message</span>
                    ) : (
                      <span className={`text-xs ${isSelected ? "text-accent" : "text-muted"}`}>
                        {isSelected ? "Added" : "Add"}
                      </span>
                    )}
                  </button>
                );
              })
          )}
          {!searching && results.length === 0 && (
            <p className="p-4 text-center text-sm text-muted">No users found.</p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-muted transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating..." : mode === "direct" ? "Message" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMembersModal({
  currentUserId,
  conversationId,
  onClose,
  onAdded,
}: {
  currentUserId: string;
  conversationId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [selected, setSelected] = useState<UserLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearching(true);
      fetch(
        `/api/messages/users?q=${encodeURIComponent(query)}&excludeConversation=${conversationId}`,
        { cache: "no-store" },
      )
        .then((response) => response.json())
        .then((data) => setResults(data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [query, conversationId]);

  function toggleUser(user: UserLite) {
    setSelected((current) =>
      current.some((u) => u.id === user.id)
        ? current.filter((u) => u.id !== user.id)
        : [...current, user],
    );
  }

  async function submit() {
    if (selected.length === 0) {
      setError("Select at least one member to add.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selected.map((u) => u.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add members.");
      onAdded();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add members.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Add members</h2>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-3 py-2">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members to add..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted"
          />
        </div>

        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUser(user)}
                className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-accent"
              >
                {userDisplayName(user)}
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
          {searching ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Searching...
            </p>
          ) : (
            results
              .filter((user) => user.id !== currentUserId)
              .map((user) => {
                const isSelected = selected.some((u) => u.id === user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                      isSelected
                        ? "border-accent/40 bg-accent/10"
                        : "border-transparent hover:border-border hover:bg-white/5"
                    }`}
                  >
                    <Avatar user={user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{userDisplayName(user)}</p>
                      <p className="truncate text-xs text-muted">@{user.profileHandle}</p>
                    </div>
                    <span className={`text-xs ${isSelected ? "text-accent" : "text-muted"}`}>
                      {isSelected ? "Added" : "Add"}
                    </span>
                  </button>
                );
              })
          )}
          {!searching && results.length === 0 && (
            <p className="p-4 text-center text-sm text-muted">No users found.</p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-muted transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Adding..." : `Add ${selected.length > 0 ? `(${selected.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
