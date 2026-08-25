"use client";

import { useEffect, useState } from "react";
import { Pencil, UserPlus } from "lucide-react";

interface Friend { id: string; username: string; displayName: string | null; profileHandle: string; avatar: string | null }
interface Conversation { id: string; type: string; name: string; memberIds: string[]; createdById: string | null; memberRoles: Record<string, string> }

export function GroupChatManager({ conversationId, currentUserId }: { conversationId?: string; currentUserId: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!conversationId) return;
    const response = await fetch("/api/messages/conversations", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const item = (data.conversations ?? []).find((entry: Conversation) => entry.id === conversationId && entry.type === "group") ?? null;
    setConversation(item);
    if (item) setName(item.name);
  }

  async function loadFriends() {
    const response = await fetch("/api/friends", { cache: "no-store" });
    if (response.ok) setFriends((await response.json()).friends ?? []);
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 3000); return () => window.clearInterval(timer); }, [conversationId]);

  useEffect(() => {
    const observer = new MutationObserver(() => mountControls());
    observer.observe(document.body, { childList: true, subtree: true });
    mountControls();
    return () => observer.disconnect();
  });

  function mountControls() {
    if (!conversation || conversation.type !== "group") return;
    const header = Array.from(document.querySelectorAll("header")).find((item) => /members/i.test(item.textContent ?? ""));
    if (!header || header.querySelector("[data-group-manager]") || conversation.memberRoles[currentUserId] !== "owner") return;
    const controls = document.createElement("div");
    controls.dataset.groupManager = "true";
    controls.className = "ml-auto flex items-center gap-2";
    const rename = document.createElement("button");
    rename.className = "inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-accent/40 hover:text-white";
    rename.title = "Rename group";
    rename.setAttribute("aria-label", "Rename group");
    rename.innerHTML = "<span>✎</span><span>Rename</span>";
    rename.onclick = () => { setError(""); setOpen(true); void loadFriends(); };
    const add = document.createElement("button");
    add.className = "inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white";
    add.title = "Add members";
    add.setAttribute("aria-label", "Add members");
    add.innerHTML = "<span>＋</span><span>Add members</span>";
    add.onclick = () => { setError(""); setOpen(true); void loadFriends(); };
    controls.append(rename, add);
    header.appendChild(controls);
  }

  if (!open || !conversation || conversation.type !== "group" || conversation.memberRoles[currentUserId] !== "owner") return null;
  const activeConversation = conversation;

  async function saveName() {
    const value = name.trim();
    if (!value) return setError("Enter a group name.");
    const response = await fetch(`/api/messages/conversations/${activeConversation.id}/name`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error ?? "Could not rename the group.");
    setOpen(false);
    window.location.reload();
  }

  async function addMembers() {
    if (selected.length === 0) return setError("Select at least one friend.");
    const response = await fetch(`/api/messages/conversations/${activeConversation.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: selected }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error ?? "Could not add users.");
    setSelected([]);
    setOpen(false);
    window.location.reload();
  }

  const available = friends.filter((friend) => !activeConversation.memberIds.includes(friend.id));

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Group management</p><h2 className="mt-1 text-2xl font-black text-white">{activeConversation.name}</h2></div><button onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-white">Close</button></div><label className="mt-5 block text-sm font-semibold text-white">Group name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-accent" /></label><button onClick={() => void saveName()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent"><Pencil size={14} /> Save name</button><div className="mt-6 border-t border-border pt-5"><p className="flex items-center gap-2 text-sm font-semibold text-white"><UserPlus size={15} /> Add members</p><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{available.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">All of your friends are already in this group.</p> : available.map((friend) => <label key={friend.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"><input type="checkbox" checked={selected.includes(friend.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, friend.id] : current.filter((id) => id !== friend.id))} /><img src={friend.avatar ?? ""} alt="" className="h-9 w-9 rounded-full object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{friend.displayName || friend.username}</span><span className="block truncate text-xs text-muted">@{friend.profileHandle}</span></span></label>)}</div><button onClick={() => void addMembers()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"><UserPlus size={15} /> Add selected</button></div>{error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}</div></div>;
}
