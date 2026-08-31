"use client";

import { useEffect, useState } from "react";

type UserResult = { id: string; username: string; displayName: string | null; profileHandle: string; rhythiaVerified: boolean; rhythiaProfile: { profileUrl: string; username: string | null; profileId: number } | null };

export function RhythiaManualLinker() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult | null>(null);
  const [profileUrl, setProfileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setUsers([]); return; }
      const response = await fetch(`/api/admin/rhythia-requests/manual?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json().catch(() => null);
      if (response.ok) setUsers(data.users ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function choose(user: UserResult) {
    setSelected(user);
    setQuery(user.username);
    setUsers([]);
    setProfileUrl(user.rhythiaProfile?.profileUrl ?? "");
    setMessage(null);
    setError(null);
  }

  async function link() {
    if (!selected || !profileUrl.trim()) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/admin/rhythia-requests/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selected.id, profileUrl }) });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(data?.error ?? "Unable to link Rhythia profile."); return; }
    setSelected((current) => current ? { ...current, rhythiaVerified: true, rhythiaProfile: { profileUrl, username: data.profile?.username ?? null, profileId: data.profile?.profileId } } : current);
    setMessage(`${selected.username} is now manually verified with the selected Rhythia profile.`);
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
    <p className="text-sm uppercase tracking-[0.3em] text-accent">Admin override</p>
    <h2 className="mt-2 text-2xl font-semibold text-white">Manually link a Rhythia profile</h2>
    <p className="mt-2 text-sm leading-7 text-muted">Search any Rhythians user, enter the Rhythia profile URL you want them linked to, and approve it immediately. The user receives a notification and their client sees the verified profile on its next refresh.</p>
    <div className="relative mt-5"><label className="text-xs uppercase tracking-[0.18em] text-muted">Search user</label><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Username, display name, profile handle, or Discord ID" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white outline-none placeholder:text-muted focus:border-accent/50" />{users.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-glow">{users.map((user) => <button key={user.id} onClick={() => choose(user)} className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left last:border-0 hover:bg-white/5"><span><span className="block font-semibold text-white">{user.displayName ?? user.username}</span><span className="text-xs text-muted">@{user.profileHandle} · {user.username}</span></span><span className="text-xs text-accent">{user.rhythiaVerified ? "Verified" : "Not verified"}</span></button>)}</div>}</div>
    {selected && <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4"><p className="font-semibold text-white">{selected.displayName ?? selected.username}</p><p className="text-sm text-muted">@{selected.profileHandle}</p><label className="mt-4 block text-xs uppercase tracking-[0.18em] text-muted">Rhythia profile URL</label><input value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="https://www.rhythia.com/player/7564" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-white outline-none placeholder:text-muted focus:border-accent/50" /><button disabled={busy || !profileUrl.trim()} onClick={link} className="mt-3 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Linking..." : "Link & approve"}</button></div>}
    {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {message && <p className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">{message}</p>}
  </section>;
}
