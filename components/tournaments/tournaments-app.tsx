"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Crown, Loader2, ShieldQuestion, Swords, Trophy, Users } from "lucide-react";
import { TournamentBracket } from "@/components/tournaments/tournament-bracket";

function Countdown({ date }: { date: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, new Date(date).getTime() - now);
  const seconds = Math.floor(remaining / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const secs = seconds % 60;
  return <span className="tabular-nums">{days ? `${days}d ` : ""}{String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>;
}

function CapCard({ label, state, teamSize }: { label: string; state: any; teamSize: number }) {
  const teams = Math.floor(Number(state.count ?? 0) / teamSize);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="flex items-center justify-between gap-3"><p className="font-semibold text-white">{label}</p><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted">{state.count}/{state.maximum}</span></div>
      <p className="mt-2 text-sm text-muted">{teams} current team{teams === 1 ? "" : "s"} · caps {state.caps.join(" / ")} players</p>
      {!state.canStart ? <p className="mt-2 text-xs text-amber-200">Needs {state.minimum - state.count} more player{state.minimum - state.count === 1 ? "" : "s"} to reach the base cap.</p> : state.atRisk ? <p className="mt-2 text-xs text-amber-200">Extra signups are not secured unless this split reaches {state.next} players.</p> : state.full ? <p className="mt-2 text-xs text-emerald-200">Maximum bracket reached.</p> : <p className="mt-2 text-xs text-emerald-200">A {state.secured}-player bracket is secured.</p>}
    </div>
  );
}

function Champion({ label, team }: { label: string; team: any }) {
  return <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-200"><Crown size={14} />{label}</p><p className="mt-3 text-xl font-bold text-white">{team?.members?.map((member: any) => member.displayName ?? member.username).join(" + ") || "No winner recorded"}</p></div>;
}

export function TournamentsApp() {
  const [data, setData] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/tournaments", { cache: "no-store" });
      const result = await response.json();
      setData(result);
    } catch {
      setMessage("Could not load tournaments.");
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data?.active?.viewerSignup?.status === "accepted" && data.active.tournament?.id) window.location.href = `/tournaments/${data.active.tournament.id}`;
  }, [data]);

  async function action(actionName: string, tournamentId: string, extra: Record<string, unknown> = {}) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, tournamentId, ...extra }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tournament action failed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tournament action failed.");
    } finally {
      setWorking(false);
    }
  }

  const scheduled = data?.scheduled;
  const recent = data?.recent;
  const active = data?.active;
  const teamSize = useMemo(() => scheduled ? Number(String(scheduled.mode).split("v")[0]) : 1, [scheduled]);
  const signup = scheduled?.viewerSignup;

  return (
    <div className="ui-page space-y-6">
      <section className="overflow-hidden rounded-[2.4rem] border border-accent/20 bg-surface/95 p-7 shadow-glow sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-accent"><Trophy size={15} /> Rhythians tournaments</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">Compete through a full bracket.</h1>
            <p className="mt-5 text-sm leading-7 text-muted sm:text-base">The tournaments will be split into two groups. <span className="font-semibold text-white">Lower</span> is Diamond rank and below, and <span className="font-semibold text-white">Higher</span> is Emerald rank and above. If your current rank does not reflect the split you should compete in, sign up first and send a split change request for admin review.</p>
          </div>
          <div className="grid min-w-[260px] gap-2 rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-muted"><p className="flex items-center gap-2"><Swords size={16} className="text-accent" /> Separate Lower and Higher brackets</p><p className="flex items-center gap-2"><Users size={16} className="text-accent" /> 1v1, 2v2, and 3v3 formats</p><p className="flex items-center gap-2"><ShieldQuestion size={16} className="text-accent" /> Admin-reviewed split changes</p></div>
        </div>
      </section>

      {active && active.viewerSignup?.status !== "accepted" && <section className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[0.06] p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Tournament live</p><div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold text-white">{active.tournament.name}</h2><p className="mt-1 text-sm text-muted">The bracket is currently in progress.</p></div><Link href={`/tournaments/${active.tournament.id}`} className="ui-button bg-accent text-white">View live bracket</Link></div></section>}

      {scheduled ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6 shadow-glow sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><CalendarClock size={15} /> Next tournament</p><h2 className="mt-2 text-3xl font-bold text-white">{scheduled.tournament.name}</h2><p className="mt-2 text-sm text-muted">{scheduled.mode} · scheduled {new Date(scheduled.tournament.scheduledAt).toLocaleString()}</p></div>
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] px-6 py-4 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Scheduled countdown</p><p className="mt-1 text-2xl font-black text-white"><Countdown date={scheduled.tournament.scheduledAt} /></p></div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2"><CapCard label="Lower split" state={scheduled.caps.lower} teamSize={teamSize} /><CapCard label="Higher split" state={scheduled.caps.higher} teamSize={teamSize} /></div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5">
          {!signup || signup.status === "withdrawn" ? <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-white">Sign up for {scheduled.tournament.name}</p><p className="mt-1 text-sm text-muted">Your starting split is assigned from your current Rhythians rank.</p></div><button disabled={working} onClick={() => void action("signup", scheduled.tournament.id)} className="ui-button bg-accent text-white disabled:opacity-50">{working ? <Loader2 size={16} className="animate-spin" /> : "Sign up"}</button></div> : <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-white">You are signed up for the <span className="capitalize text-accent">{signup.split}</span> split.</p><p className="mt-1 text-sm text-muted">Status: {signup.status}{signup.splitRequestStatus === "pending" ? ` · ${signup.requestedSplit} split request pending` : ""}</p></div><button disabled={working} onClick={() => void action("withdraw", scheduled.tournament.id)} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-50">Withdraw</button></div>
            {scheduled.caps[signup.split]?.atRisk && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">This split is between secured bracket caps. You might not be accepted unless it reaches {scheduled.caps[signup.split].next} players.</p>}
            {signup.splitRequestStatus !== "pending" && <button disabled={working} onClick={() => void action("request-split", scheduled.tournament.id, { split: signup.split === "lower" ? "higher" : "lower" })} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Request {signup.split === "lower" ? "Higher" : "Lower"} split</button>}
          </div>}
        </div>
      </section> : <section className="rounded-[2rem] border border-dashed border-white/10 bg-surface/60 p-10 text-center"><Trophy className="mx-auto text-muted" size={30} /><h2 className="mt-4 text-xl font-semibold text-white">No tournament is scheduled</h2><p className="mt-2 text-sm text-muted">The next signup period will appear here when an admin publishes a tournament.</p></section>}

      {message && <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{message}</p>}

      {recent && <div className="space-y-5"><section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6"><p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Most recent tournament</p><h2 className="mt-2 text-3xl font-bold text-white">{recent.tournament.name}</h2><p className="mt-2 text-sm text-muted">Final results remain here until the next tournament begins.</p><div className="mt-5 grid gap-3 md:grid-cols-2"><Champion label="Lower winner" team={recent.champions.lower} /><Champion label="Higher winner" team={recent.champions.higher} /></div></section><TournamentBracket matches={recent.matches} split="lower" /><TournamentBracket matches={recent.matches} split="higher" /></div>}
    </div>
  );
}
