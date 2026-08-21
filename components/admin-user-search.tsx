"use client";

import { useState } from "react";
import { User, Search, ShieldAlert, ShieldOff, BellOff, Bell, TriangleAlert, RotateCcw } from "lucide-react";
import { FlagIcon } from "@/components/flag-icon";
import { getRankInfo } from "@/lib/ranks";

type SearchedUser = {
  id: string;
  username: string;
  discriminator: string;
  displayName: string | null;
  profileHandle: string;
  discordId: string | null;
  email: string | null;
  hasPassword: boolean;
  avatar: string | null;
  bio: string | null;
  website: string | null;
  inGuild: boolean;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  playerRank: string | null;
  userTags: Array<{ tag: { name: string; slug: string } }>;
  roles: string[];
  warnings: Array<{ id: string; reason: string; createdAt: string; actor: string }>;
  rhythiaProfile: {
    profileId: number;
    profileUrl: string;
    username: string | null;
    country: string | null;
    flag: string | null;
    globalRank: number | null;
    countryRank: number | null;
    rhythmPoints: number | null;
    isOnline: boolean | null;
    lastActiveAt: string | null;
    syncedAt: string;
  } | null;
  stats: { clips: number; comments: number; messages: number; reportsFiled: number; warnings: number };
  ranked: {
    rhp: number;
    avgMapRating: number | null;
    scoreImportDone: boolean;
    dailyStreak: number;
    lastDailyBeatAt: string | null;
    lastRhythiaRpCheckAt: string | null;
    rhythiaVerified: boolean;
    completions: number;
    dailyBeats: number;
    rhpTransactions: number;
  };
  profileTitle: string;
  profileTitleColor: string;
  canEditTitle: boolean;
  moderation: {
    isSuspended: boolean;
    suspensionExpiry: string | null;
    isMuted: boolean;
    muteExpiry: string | null;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}

function timeUntil(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h remaining`;
  const mins = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  return `${hours > 0 ? `${hours}h ` : ""}${mins}m remaining`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-accent">{label}</span>
      <span className="break-all text-right text-sm text-white">{value}</span>
    </div>
  );
}

export function AdminUserSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [user, setUser] = useState<SearchedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [editForm, setEditForm] = useState({ displayName: "", bio: "", website: "", profileHandle: "" });
  const [title, setTitle] = useState("");
  const [titleColor, setTitleColor] = useState("#a78bfa");
  const [rhpInput, setRhpInput] = useState("");
  const [resetting, setResetting] = useState(false);

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setError("");
    setSearched(false);
    setUser(null);
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not find this user.");
      if (!data.user) {
        setSearched(true);
        return;
      }
      setUser(data.user);
      setEditForm({
        displayName: data.user.displayName ?? "",
        bio: data.user.bio ?? "",
        website: data.user.website ?? "",
        profileHandle: data.user.profileHandle,
      });
      setTitle(data.user.profileTitle ?? "");
      setTitleColor(data.user.profileTitleColor ?? "#a78bfa");
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Could not find this user.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function act(payload: Record<string, unknown>) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/moderation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      await search();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save changes.");
      setShowEdit(false);
      await search();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle() {
    if (!user || !user.canEditTitle) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/profile-title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, color: titleColor }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save profile title.");
      setTitle(data.title ?? "");
      setTitleColor(data.color ?? "#a78bfa");
      await search();
    } catch (titleError) {
      setError(titleError instanceof Error ? titleError.message : "Could not save profile title.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRhp() {
    if (!user) return;
    const rhp = Number(rhpInput);
    if (!Number.isFinite(rhp) || rhp < 0) {
      setError("Enter a valid RHP value (0 or more).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rhp: Math.round(rhp) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update RHP.");
      setRhpInput("");
      await search();
    } catch (rhpError) {
      setError(rhpError instanceof Error ? rhpError.message : "Could not update RHP.");
    } finally {
      setBusy(false);
    }
  }

  async function resetRanked() {
    if (!user) return;
    if (!window.confirm(`Reset ${user.displayName ?? user.username}'s entire ranked status? This sets RHP, rank, tier, and all completed map history back to zero. This cannot be undone.`)) return;
    setResetting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetRanked: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not reset ranked status.");
      await search();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset ranked status.");
    } finally {
      setResetting(false);
    }
  }

  const durationOptions = [1, 3, 7, 14, 30, 90, 365];
  const hourOptions = [1, 6, 12, 24, 72, 168, 720];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <User size={20} />
          </div>
          <div>
            <p className="font-semibold text-white">Find a user</p>
            <p className="text-sm text-muted">Search by username, handle, Discord ID, or email.</p>
          </div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); search(); }} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users…" className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-accent" />
          <button type="submit" disabled={loading || query.trim().length < 2} className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"><Search size={16} />{loading ? "Searching…" : "Search"}</button>
        </form>
      </section>

      {error ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {searched && !user && !loading && !error ? <p className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">No user found.</p> : null}

      {user ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white">{user.displayName ?? user.username}</h2>
                  {user.moderation.isSuspended && <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-300">{user.moderation.suspensionExpiry ? "Suspended" : "Banned"}</span>}
                  {user.moderation.isMuted && <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-300">Muted</span>}
                </div>
                <p className="mt-1 text-sm text-muted">@{user.profileHandle} · {user.username}#{user.discriminator}</p>
                {user.profileTitle && <p className="mt-1 text-sm font-semibold" style={{ color: user.profileTitleColor }}>{user.profileTitle}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">{user.userTags.map((ut) => <span key={ut.tag.slug} className="rounded-full border border-border bg-white/5 px-2 py-0.5 text-white">{ut.tag.name}</span>)}{user.userTags.length === 0 && "No tags"}</p>
              </div>
              <button onClick={() => setShowEdit((current) => !current)} disabled={busy} className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent/40 disabled:opacity-50">{showEdit ? "Close editor" : "Edit account"}</button>
            </div>

            {showEdit && <div className="mt-6 space-y-4 rounded-3xl border border-border bg-background/60 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">Edit account</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs text-muted">Display name</span><input value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label>
                <label className="block"><span className="mb-1 block text-xs text-muted">Profile handle</span><input value={editForm.profileHandle} onChange={(e) => setEditForm({ ...editForm, profileHandle: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label>
                <label className="block"><span className="mb-1 block text-xs text-muted">Website</span><input value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label>
                <label className="block sm:col-span-2"><span className="mb-1 block text-xs text-muted">Bio</span><textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label>
              </div>
              <button onClick={saveEdit} disabled={busy} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
              {user.canEditTitle && <div className="rounded-2xl border border-border bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">Profile title</p>
                <p className="mt-1 text-xs text-muted">Shown under the user's name on their public profile.</p>
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} placeholder="Profile title" className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" />
                <div className="mt-3 flex flex-wrap items-center gap-2"><input type="color" value={titleColor} onChange={(event) => setTitleColor(event.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-background p-1" /><input value={titleColor} onChange={(event) => setTitleColor(event.target.value)} maxLength={7} className="w-28 rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /><span className="text-sm font-semibold" style={{ color: titleColor }}>{title || "Preview"}</span></div>
                <button onClick={saveTitle} disabled={busy} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50">{busy ? "Saving…" : "Save title"}</button>
              </div>}
            </div>}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Account</p>
                <InfoRow label="User ID" value={user.id} />
                <InfoRow label="Discord ID" value={user.discordId ?? "—"} />
                <InfoRow label="Login method" value={[user.discordId ? "Discord" : null, user.hasPassword ? "Password" : null].filter(Boolean).join(" + ") || "Unknown"} />
                <InfoRow label="Email" value={user.email ?? "—"} />
                <InfoRow label="Joined" value={formatDate(user.joinedAt)} />
