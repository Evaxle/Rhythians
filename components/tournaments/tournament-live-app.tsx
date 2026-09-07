"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Download, Loader2, ShieldAlert, Swords, Trophy, Users } from "lucide-react";
import { TournamentBracket } from "@/components/tournaments/tournament-bracket";

function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  return <span className="tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>;
}

function TeamLabel({ team }: { team: any }) {
  return <>{team?.members?.map((member: any) => member.displayName ?? member.username).join(" + ") || "TBD"}</>;
}

export function TournamentLiveApp({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function load() {
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tournament not found.");
      setData(result);
      if (result.viewerScore?.accuracy != null) setSubmitted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update tournament.");
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [tournamentId]);

  async function action(name: string) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tournament action failed.");
      if (name === "check-score") {
        setSubmitted(true);
        setMessage(result.alreadySubmitted ? "Your score was already submitted." : `Score submitted: ${Number(result.accuracy).toFixed(2)}%.`);
      }
      setConfirmForfeit(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tournament action failed.");
    } finally {
      setWorking(false);
    }
  }

  if (!data) return <div className="ui-page flex min-h-[65vh] items-center justify-center text-muted"><Loader2 size={18} className="mr-2 animate-spin" />Loading tournament...</div>;
  const current = data.currentMatch;
  const viewerAccepted = data.viewerSignup?.status === "accepted";
  const currentTeam = current && data.viewerTeam?.id === current.team1Id ? current.team1 : current && data.viewerTeam?.id === current.team2Id ? current.team2 : data.viewerTeam;
  const opponent = current && data.viewerTeam?.id === current.team1Id ? current.team2 : current && data.viewerTeam?.id === current.team2Id ? current.team1 : null;

  return (
    <div className="ui-page space-y-6">
      <section className="rounded-[2.3rem] border border-accent/20 bg-surface/95 p-7 shadow-glow sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-accent"><Trophy size={15} /> Live tournament</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-white">{data.tournament.name}</h1><p className="mt-2 text-sm text-muted">{data.mode} · {data.tournament.status} · Lower and Higher brackets are fully separate.</p></div>{data.viewerSignup && <div className="rounded-2xl border border-white/10 bg-black/15 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Your tournament status</p><p className="mt-1 font-bold capitalize text-white">{data.viewerEliminated ? "Eliminated" : data.viewerSignup.status} · {data.viewerSignup.split}</p></div>}</div>
      </section>

      {viewerAccepted && !data.viewerEliminated && current ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6 shadow-glow sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><Swords size={14} /> Your match · Round {current.round}</p><h2 className="mt-2 text-2xl font-bold text-white">{currentTeam ? <TeamLabel team={currentTeam} /> : "Your team"} <span className="mx-2 text-muted">vs</span> {opponent ? <TeamLabel team={opponent} /> : "Waiting for opponent"}</h2></div><span className="rounded-full border border-white/10 bg-black/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">{String(current.status).replace("_", " ")}</span></div>
        {current.status === "countdown" && current.countdownEndsAt && <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-center"><Clock3 className="mx-auto text-amber-200" size={26} /><p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Round starts in</p><p className="mt-1 text-4xl font-black text-white"><Countdown deadline={current.countdownEndsAt} /></p><p className="mt-2 text-sm text-amber-100">Your battle ID and tournament map are created automatically when the countdown reaches zero.</p></div>}
        {current.status === "waiting" && <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-6 text-center"><Users className="mx-auto text-muted" size={25} /><p className="mt-3 font-semibold text-white">Waiting room</p><p className="mt-1 text-sm text-muted">You advanced. Your next opponent will appear as soon as the other side of this bracket finishes.</p></div>}
        {current.status === "needs_admin" && <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5"><p className="flex items-center gap-2 font-semibold text-amber-100"><ShieldAlert size={17} />Admin resolution required</p><p className="mt-1 text-sm text-amber-100/80">The match tied or ended without enough score data. The bracket is paused for this matchup until an admin selects the winner.</p></div>}
        {current.status === "active" && current.map && <div className="mt-6 rounded-3xl border border-accent/15 bg-accent/[0.04] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center">{current.map.imageUrl && <img src={current.map.imageUrl} alt="" className="h-28 w-full rounded-2xl object-cover md:w-40" />}<div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Tournament map</p><h3 className="mt-1 truncate text-xl font-bold text-white">{current.map.title}</h3><p className="mt-1 text-sm text-muted">{current.map.artist || ""}{current.map.rating != null ? ` · ${Number(current.map.rating).toFixed(2)}★` : ""}{current.map.length != null ? ` · ${Math.floor(Number(current.map.length) / 60)}:${String(Number(current.map.length) % 60).padStart(2, "0")}` : ""}</p>{current.battleMatchId && <p className="mt-2 text-xs text-muted">Battle ID: <span className="font-mono text-white">{current.battleMatchId}</span></p>}</div><div className="flex flex-wrap gap-2">{current.map.mapFileUrl && <a href={current.map.mapFileUrl} className="ui-button border border-white/10 bg-white/5 text-white"><Download size={16} />Map</a>}<button disabled={working || submitted} onClick={() => void action("check-score")} className="ui-button bg-accent text-white disabled:opacity-45">{working ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{submitted ? "Score submitted" : "Check score"}</button></div></div>{current.matchDeadlineAt && <p className="mt-4 text-sm text-muted">Match time remaining: <span className="font-bold text-white"><Countdown deadline={current.matchDeadlineAt} /></span>. The timer is based on the map length, with a 10-minute minimum and a 15-minute maximum.</p>}<button onClick={() => setConfirmForfeit(true)} className="mt-4 rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200">Forfeit match</button></div>}
      </section> : viewerAccepted && data.viewerEliminated ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-8 text-center"><Trophy className="mx-auto text-muted" size={28} /><h2 className="mt-3 text-2xl font-bold text-white">Your tournament run is complete</h2><p className="mt-2 text-sm text-muted">You can keep this page open to watch both brackets finish.</p></section> : viewerAccepted && data.tournament.status === "completed" ? null : <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-7 text-center"><p className="text-sm text-muted">You are viewing the live public bracket.</p></section>}

      {message && <p className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 text-sm text-white">{message}</p>}
      <TournamentBracket matches={data.matches} split="lower" mode={data.mode} />
      <TournamentBracket matches={data.matches} split="higher" mode={data.mode} />

      {confirmForfeit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101629] p-7 shadow-2xl"><h2 className="text-xl font-bold text-white">Forfeit this tournament match?</h2><p className="mt-2 text-sm leading-6 text-muted">Your opposing team will immediately advance and your team will be eliminated from this split.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmForfeit(false)} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-white">Cancel</button><button disabled={working} onClick={() => void action("forfeit")} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Confirm forfeit</button></div></div></div>}
    </div>
  );
}
