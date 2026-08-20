"use client";

import { FormEvent, useMemo, useState } from "react";

export type AlertUser = {
  id: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
};

export function SendAlertForm({ users, usersWithoutTags }: { users: AlertUser[]; usersWithoutTags: number }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState(false);
  const [setupUsers, setSetupUsers] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return users;
    return users.filter((user) => `${user.username} ${user.displayName ?? ""} ${user.profileHandle}`.toLowerCase().includes(value));
  }, [query, users]);

  const toggleUser = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setAllUsers(false);
    setSetupUsers(false);
  };

  const toggleAll = () => {
    setAllUsers((current) => !current);
    setSelected([]);
    setSetupUsers(false);
  };

  const sendSetupAlert = async () => {
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupUsers: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to send setup alert");
      setResult(`Tag setup alert sent to ${data.sent} user${data.sent === 1 ? "" : "s"}.`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unable to send setup alert");
    } finally {
      setSending(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, message, url: url || null, allUsers, userIds: selected, setupUsers }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to send alert");
      setResult(`Alert sent to ${data.sent} user${data.sent === 1 ? "" : "s"}.`);
      setTitle(""); setMessage(""); setUrl(""); setSelected([]); setAllUsers(false); setSetupUsers(false);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unable to send alert");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-accent/30 bg-accent/5 p-6 shadow-glow">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Quick action</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Users who need tags</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Send one alert to every user with no tags. It opens the tag setup flow, checks Discord membership, provides a join button when needed, and shows the tag questions.</p>
        <button type="button" onClick={sendSetupAlert} disabled={sending || usersWithoutTags === 0} className="mt-5 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Sending..." : `Send tag setup alert (${usersWithoutTags})`}</button>
      </section>

      <form onSubmit={submit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div><p className="text-sm uppercase tracking-[0.3em] text-accent">User alerts</p><h2 className="mt-2 text-2xl font-semibold text-white">Send an alert</h2><p className="mt-2 text-sm leading-6 text-muted">Send an in-site notification to everyone or selected users.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2"><span className="text-sm text-muted">Title</span><input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" maxLength={120} /></label>
          <label className="space-y-2"><span className="text-sm text-muted">Link (optional)</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/wiki or https://..." className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" maxLength={500} /></label>
        </div>
        <label className="block space-y-2"><span className="text-sm text-muted">Message</span><textarea required value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-32 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" maxLength={1000} /></label>
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-3 text-sm font-semibold text-white"><input type="checkbox" checked={allUsers} onChange={toggleAll} className="h-4 w-4" /> All users</label><span className="text-xs text-muted">{allUsers ? `${users.length} users selected` : `${selected.length} users selected`}</span></div>
          <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-white"><input type="checkbox" checked={setupUsers} onChange={() => { setSetupUsers((current) => !current); setAllUsers(false); setSelected([]); }} className="h-4 w-4" /> Users without tags</label>
          {!allUsers && !setupUsers && <><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users..." className="mt-4 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-white outline-none focus:border-accent" /><div className="mt-3 max-h-64 overflow-y-auto space-y-1">{filteredUsers.map((user) => <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/5"><input type="checkbox" checked={selected.includes(user.id)} onChange={() => toggleUser(user.id)} className="h-4 w-4" /><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{user.displayName ?? user.username}</span><span className="block truncate text-xs text-muted">@{user.profileHandle}</span></span></label>)}</div></>}
        </div>
        <div className="flex flex-wrap items-center gap-4"><button disabled={sending || (!allUsers && !setupUsers && selected.length === 0)} className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Sending..." : "Send alert"}</button>{result && <p className="text-sm text-muted">{result}</p>}</div>
      </form>
    </div>
  );
}
