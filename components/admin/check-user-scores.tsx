"use client";

import { useState } from "react";
import { RefreshCw, Search } from "lucide-react";

type UserResult = { id: string; username: string; displayName: string | null };

export function AdminCheckUserScores() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<UserResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function search() {
    setError("");
    setMessage("");
    setUser(null);
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Search failed.");
      if (!data.user) throw new Error("No user found.");
      setUser({ id: data.user.id, username: data.user.username, displayName: data.user.displayName });
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function check(payload: Record<string, unknown>) {
    if (payload.userId && !window.confirm(`Check all ranked and legacy map passes for ${user?.displayName ?? user?.username}?`)) return;
    if (payload.all && !window.confirm("Check ranked and legacy map passes for every user with a linked Rhythia profile? Unlinked users will be reported as skipped.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/users/check-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Score check failed.");
      if (data.mode === "all") {
        const failureText = data.failedUsers > 0 ? ` ${data.failedUsers} linked user${data.failedUsers === 1 ? "" : "s"} failed and can be retried.` : "";
        setMessage(`Scanned ${data.usersChecked} of ${data.totalUsers} total users (${data.linkedUsers} linked, ${data.skippedUnlinked} unlinked skipped). Checked ${data.mapsChecked} ranked/legacy map entries, found ${data.foundScores} passes, recorded ${data.newlyCompleted} new completions, and awarded ${data.awardedPoints} RHP.${failureText}`);
      } else {
        setMessage(`Checked ${data.mapsChecked} ranked/legacy map entries for ${data.user?.displayName ?? data.user?.username ?? "user"}; found ${data.foundScores} passes, recorded ${data.newlyCompleted} new completions, and awarded ${data.awardedPoints} RHP.`);
      }
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Score check failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">Ranked score tools</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Recheck completed maps</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">Scan each linked Rhythia account for passed ranked maps in that player&apos;s current rank range plus legacy maps. The all-users scan attempts every linked account, reports unlinked users separately, and continues even if one Rhythia profile fails.</p>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Search username, handle, Discord ID, or email" className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" />
        <button type="button" onClick={() => void search()} disabled={busy || query.trim().length < 2} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-accent/40 disabled:opacity-50"><Search size={16} /> Find user</button>
        <button type="button" onClick={() => void check({ all: true })} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"><RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Check all users</button>
      </div>
      {user && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{user.displayName ?? user.username}</p><p className="text-xs text-muted">{user.username}</p></div><button type="button" onClick={() => void check({ userId: user.id })} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"><RefreshCw size={15} /> Check this user</button></div>}
      {message && <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}
      {error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    </section>
  );
}
