"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, RefreshCw, Search, ShieldCheck, Star, Users, X } from "lucide-react";

type SplitFilter = "all" | "lower" | "higher";
type StatusFilter = "all" | "registered" | "accepted" | "waitlisted" | "withdrawn";

function formatIdentity(signup: any) {
  if (!signup.streamOptIn) return "Not requested";
  if (signup.streamPlatform === "nightly") return `Nightly · Discord${signup.discordId ? ` (${signup.discordId})` : ""}`;
  if (signup.streamIdentity === "discord") return `Steam · Discord${signup.discordId ? ` (${signup.discordId})` : ""}`;
  return `Steam · Rhythia${signup.rhythiaUsername ? ` (${signup.rhythiaUsername})` : ""}`;
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function TournamentSignupsAdmin() {
  const [state, setState] = useState<any>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [splitFilter, setSplitFilter] = useState<SplitFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load(id = selectedId, silent = false) {
    try {
      const response = await fetch(`/api/admin/tournaments${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load tournament signups.");
      setState(data);
      const nextId = data.selected?.tournament?.id ?? data.tournaments?.[0]?.id ?? "";
      setSelectedId(nextId);
      setLastUpdated(new Date());
      if (!silent) setMessage("");
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : "Could not load tournament signups.");
    }
  }

  useEffect(() => { void load(""); }, []);
  useEffect(() => {
    if (!selectedId) return;
    const timer = setInterval(() => void load(selectedId, true), 10_000);
    return () => clearInterval(timer);
  }, [selectedId]);

  async function action(actionName: string, payload: Record<string, unknown>) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, tournamentId: selectedId, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Tournament signup update failed.");
      setState(data.state);
      setLastUpdated(new Date());
      setMessage("Signup updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tournament signup update failed.");
    } finally {
      setWorking(false);
    }
  }

  const selected = state?.selected;
  const signups = selected?.signups ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return signups.filter((signup: any) => {
      if (splitFilter !== "all" && signup.split !== splitFilter) return false;
      if (statusFilter !== "all" && signup.status !== statusFilter) return false;
      if (!needle) return true;
      return [signup.username, signup.displayName, signup.profileHandle, signup.rhythiaUsername, signup.discordId].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [signups, query, splitFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: signups.filter((signup: any) => signup.status !== "withdrawn").length,
    lower: signups.filter((signup: any) => signup.status !== "withdrawn" && signup.split === "lower").length,
    higher: signups.filter((signup: any) => signup.status !== "withdrawn" && signup.split === "higher").length,
    pending: signups.filter((signup: any) => signup.status !== "withdrawn" && signup.splitRequestStatus === "pending").length,
    stream: signups.filter((signup: any) => signup.status !== "withdrawn" && signup.streamOptIn).length,
    waitlisted: signups.filter((signup: any) => signup.status === "waitlisted").length,
  }), [signups]);

  function teamFor(signup: any) {
    return selected?.teams?.find((team: any) => team.members?.some((member: any) => member.userId === signup.userId)) ?? null;
  }

  function matchFor(team: any) {
    if (!team) return null;
    const matches = selected?.matches ?? [];
    return matches.find((match: any) => ["countdown", "active", "needs_admin"].includes(match.status) && (match.team1Id === team.id || match.team2Id === team.id))
      ?? matches.find((match: any) => match.status === "waiting" && (match.team1Id === team.id || match.team2Id === team.id))
      ?? null;
  }

  function exportCsv() {
    if (!selected) return;
    const headers = ["Rhythians username","Profile handle","Signed up","Status","Rank","RHP snapshot","Current RHP","Split","Split request","Priority","Livestream","Platform","Identity","Discord ID","Discord in server","Rhythia username","Rhythia verified","Team seed","Bracket team","Match status","Round"];
    const rows = filtered.map((signup: any) => {
      const team = teamFor(signup);
      const match = matchFor(team);
      return [
        signup.displayName ?? signup.username,
        signup.profileHandle,
        signup.signedUpAt ? new Date(signup.signedUpAt).toISOString() : "",
        signup.status,
        `${signup.rankName} ${signup.rankTier}`,
        signup.rhpSnapshot,
        signup.currentRhp,
        signup.split,
        signup.splitRequestStatus === "pending" ? signup.requestedSplit : signup.splitRequestStatus,
        signup.priority ? "yes" : "no",
        signup.streamOptIn ? "yes" : "no",
        signup.streamPlatform ?? "",
        signup.streamIdentity ?? "",
        signup.discordId ?? "",
        signup.inGuild ? "yes" : "no",
        signup.rhythiaUsername ?? "",
        signup.rhythiaVerified ? "yes" : "no",
        team?.seed ?? "",
        team?.members?.map((member: any) => member.displayName ?? member.username).join(" + ") ?? "",
        match?.status ?? "",
        match?.round ?? "",
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.tournament.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-signups.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Tournament signups</p><h1 className="mt-2 text-3xl font-semibold text-white">Entrants, form answers, and placement</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Review every signup in one place, including livestream answers, Discord/Rhythia identity, rank snapshot, split requests, waitlist state, bracket team, seed, and current match.</p></div>
          <div className="flex min-w-[280px] flex-col gap-2 sm:flex-row lg:flex-col">
            <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); void load(event.target.value); }} className="min-w-0 rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white">
              {(state?.tournaments ?? []).map((tournament: any) => <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.status}</option>)}
            </select>
            <button onClick={() => void load(selectedId)} className="ui-button justify-center border border-white/10 bg-white/5 text-white"><RefreshCw size={16} />Refresh</button>
          </div>
        </div>
        {lastUpdated && <p className="mt-3 text-xs text-muted">Auto-refreshes every 10 seconds · last update {lastUpdated.toLocaleTimeString()}</p>}
      </section>

      {message && <p className={`rounded-2xl border px-4 py-3 text-sm ${message === "Signup updated." ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-rose-400/20 bg-rose-400/10 text-rose-100"}`}>{message}</p>}

      {selected ? <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Active signups", stats.total, "text-white"],
            ["Lower", stats.lower, "text-sky-200"],
            ["Higher", stats.higher, "text-violet-200"],
            ["Split requests", stats.pending, stats.pending ? "text-amber-200" : "text-white"],
            ["Livestream", stats.stream, "text-fuchsia-200"],
            ["Waitlisted", stats.waitlisted, stats.waitlisted ? "text-amber-200" : "text-white"],
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-surface/80 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></div>)}
        </section>

        <section className="rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username, Discord ID, or Rhythia username" className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-accent/40" /></div>
            <div className="flex flex-wrap gap-2"><select value={splitFilter} onChange={(event) => setSplitFilter(event.target.value as SplitFilter)} className="rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white"><option value="all">All splits</option><option value="lower">Lower</option><option value="higher">Higher</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-2xl border border-white/10 bg-[#101629] px-4 py-3 text-sm text-white"><option value="all">All statuses</option><option value="registered">Registered</option><option value="accepted">Accepted</option><option value="waitlisted">Waitlisted</option><option value="withdrawn">Withdrawn</option></select><button onClick={exportCsv} className="ui-button border border-white/10 bg-white/5 text-white"><Download size={16} />Export CSV</button></div>
          </div>

          <div className="mt-5 grid gap-4">
            {filtered.map((signup: any) => {
              const team = teamFor(signup);
              const match = matchFor(team);
              const pending = signup.splitRequestStatus === "pending";
              return <article key={signup.id} className={`rounded-3xl border p-5 ${pending ? "border-amber-400/25 bg-amber-400/[0.045]" : "border-white/10 bg-black/15"}`}>
                <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_1fr_1fr]">
                  <div>
                    <div className="flex items-center gap-2"><p className="font-semibold text-white">{signup.displayName ?? signup.username}</p>{signup.priority && <Star size={14} className="fill-accent text-accent" />}</div>
                    <Link href={`/profile/${encodeURIComponent(signup.profileHandle)}`} className="mt-1 inline-block text-xs text-accent hover:underline">@{signup.profileHandle}</Link>
                    <p className="mt-3 text-xs text-muted">Signed up {signup.signedUpAt ? new Date(signup.signedUpAt).toLocaleString() : "—"}</p>
                    <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-white">{signup.status}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-white">{signup.split} split</span></div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Rank snapshot</p>
                    <p className="mt-2 font-semibold text-white">{signup.rankName} {signup.rankTier}</p><p className="text-xs text-muted">{Number(signup.rhpSnapshot).toLocaleString()} RHP at signup</p><p className="mt-1 text-xs text-muted">Current: {Number(signup.currentRhp).toLocaleString()} RHP</p>
                    <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Split request</p>{pending ? <p className="mt-1 text-sm font-semibold text-amber-200">Requests {signup.requestedSplit}</p> : <p className="mt-1 text-sm capitalize text-muted">{signup.splitRequestStatus}</p>}</div>
                  </div>

                  <div>
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted"><ShieldCheck size={13} /> Signup form</p>
                    <p className={`mt-2 text-sm font-semibold ${signup.streamOptIn ? "text-fuchsia-200" : "text-muted"}`}>{signup.streamOptIn ? "Wants livestream coverage" : "No livestream request"}</p>
                    <p className="mt-1 text-xs text-muted">{formatIdentity(signup)}</p>
                    <div className="mt-3 space-y-1 text-xs text-muted"><p>Discord: {signup.discordId ?? "not linked"} {signup.discordId ? signup.inGuild ? "· in server" : "· not in server" : ""}</p><p>Rhythia: {signup.rhythiaUsername ?? "not linked"} {signup.rhythiaVerified ? "· verified" : "· not verified"}</p></div>
                  </div>

                  <div>
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted"><Users size={13} /> Bracket placement</p>
                    {team ? <><p className="mt-2 font-semibold text-white">Seed #{team.seed}</p><p className="mt-1 text-xs leading-5 text-muted">{team.members?.map((member: any) => member.displayName ?? member.username).join(" + ")}</p>{match ? <p className="mt-3 text-xs text-accent">Round {match.round} · {String(match.status).replace(/_/g, " ")}</p> : <p className="mt-3 text-xs text-muted">Waiting for next bracket match</p>}</> : <p className="mt-2 text-sm text-muted">Not bracketed yet.</p>}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  {pending && <><button disabled={working} onClick={() => void action("resolve-split", { userId: signup.userId, approve: true })} className="ui-button bg-emerald-600 text-white disabled:opacity-40"><Check size={15} />Approve {signup.requestedSplit}</button><button disabled={working} onClick={() => void action("resolve-split", { userId: signup.userId, approve: false })} className="ui-button border border-rose-400/20 bg-rose-400/10 text-rose-100 disabled:opacity-40"><X size={15} />Deny request</button></>}
                  <button disabled={working || selected.tournament.status !== "scheduled"} onClick={() => void action("set-split", { userId: signup.userId, split: signup.split === "lower" ? "higher" : "lower" })} className="ui-button border border-white/10 bg-white/5 text-white disabled:opacity-35">Move to {signup.split === "lower" ? "Higher" : "Lower"}</button>
                  <button disabled={working || selected.tournament.status !== "scheduled"} onClick={() => void action("priority", { userId: signup.userId, priority: !signup.priority })} className="ui-button border border-white/10 bg-white/5 text-white disabled:opacity-35">{signup.priority ? "Remove priority" : "Mark priority"}</button>
                </div>
              </article>;
            })}
            {!filtered.length && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">No signups match these filters.</div>}
          </div>
        </section>
      </> : <section className="rounded-3xl border border-dashed border-white/10 bg-surface/60 p-10 text-center text-sm text-muted">No tournament records are available yet.</section>}
    </div>
  );
}
