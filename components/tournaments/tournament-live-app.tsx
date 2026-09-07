"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Clock3, Download, Loader2, ShieldAlert, Swords, Trophy, Users } from "lucide-react";
import { TournamentBracket } from "@/components/tournaments/tournament-bracket";
import { TournamentFinalsSpotlight } from "@/components/tournaments/tournament-finals-spotlight";
import { TournamentSplitChat } from "@/components/tournaments/tournament-split-chat";

function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  return <span className="tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>;
}

function TeamLabel({ team }: { team: any }) {
  return <>{team?.members?.map((member: any) => member.displayName ?? member.username).join(" + ") || "TBD"}</>;
}

function PhaseCard({ current }: { current: any }) {
  if (current.status === "waiting") return <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-6 text-center"><Users className="mx-auto text-muted" size={25} /><p className="mt-3 font-semibold text-white">Waiting for your next opponent</p><p className="mt-1 text-sm text-muted">You advanced. This card updates automatically when the other side of your next matchup finishes.</p></div>;
  if (current.status === "intermission" && current.countdownEndsAt) return <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/[0.07] p-6 text-center"><Clock3 className="mx-auto text-sky-200" size={26} /><p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-sky-200">Preparation period</p><p className="mt-1 text-4xl font-black text-white"><Countdown deadline={current.countdownEndsAt} /></p><p className="mx-auto mt-2 max-w-2xl text-sm text-sky-100/80">Your opponent is locked. Stay on this page; a notification and one-minute countdown will warn you before the map is revealed.</p></div>;
  if (current.status === "map_countdown" && current.countdownEndsAt) return <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-6 text-center"><BellRing className="mx-auto animate-pulse text-amber-200" size={27} /><p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">Map reveal in</p><p className="mt-1 text-4xl font-black text-white"><Countdown deadline={current.countdownEndsAt} /></p><p className="mx-auto mt-2 max-w-2xl text-sm text-amber-100/80">Be ready. The assigned map is still hidden from the public API and appears for both teams when this timer reaches zero.</p></div>;
  return null;
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
      setSubmitted(result.viewerScore?.accuracy != null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update tournament.");
    }
  }

  async function heartbeat() {
    if (document.visibilityState !== "visible") return;
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "heartbeat" }) });
      if (!response.ok && response.status !== 400) throw new Error("Heartbeat failed");
    } catch {}
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [tournamentId]);

  const viewerAccepted = data?.viewerSignup?.status === "accepted";
  useEffect(() => {
    if (!viewerAccepted || data?.tournament?.status !== "active") return;
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void heartbeat(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [viewerAccepted, data?.tournament?.status, tournamentId]);

  useEffect(() => setSubmitted(data?.viewerScore?.accuracy != null), [data?.currentMatch?.id, data?.viewerScore?.accuracy]);

  async function action(name: string) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tournament action failed.");
      if (name === "check-score") {
        setSubmitted(true);
        setMessage(result.alreadySubmitted ? "Your score was already locked for this match." : `Score submitted: ${Number(result.accuracy).toFixed(2)}%.`);
      }
      setConfirmForfeit(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tournament action failed.");
    } finally { setWorking(false); }
  }

  if (!data) return <div className="ui-page flex min-h-[65vh] items-center justify-center text-muted"><Loader2 size={18} className="mr-2 animate-spin" />Loading tournament…</div>;

  const current = data.currentMatch;
  const kicked = data.viewerSignup?.status === "kicked";
  const currentTeam = current && data.viewerTeam?.id === current.team1Id ? current.team1 : current && data.viewerTeam?.id === current.team2Id ? current.team2 : data.viewerTeam;
  const opponent = current && data.viewerTeam?.id === current.team1Id ? current.team2 : current && data.viewerTeam?.id === current.team2Id ? current.team1 : null;
  const phaseLabel = current ? String(current.status).replace(/_/g, " ") : null;

  return <div className="ui-page space-y-6">
    <section className="overflow-hidden rounded-[2.3rem] border border-accent/20 bg-[radial-gradient(circle_at_10%_0%,rgba(124,143,240,.14),transparent_32%),linear-gradient(145deg,rgba(20,27,45,.97),rgba(8,12,22,.98))] p-7 shadow-glow sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-accent"><Trophy size={15} /> {data.tournament.status === "completed" ? "Tournament archive" : "Live tournament"}</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-white">{data.tournament.name}</h1><p className="mt-2 text-sm text-muted">{data.mode} · event ID <span className="font-mono text-white">{data.tournament.id}</span> · {data.runtime?.targetPlayersPerSplit ?? "—"} players per split</p><p className="mt-1 text-xs text-muted">Canonical live address: <span className="font-mono text-white">/tournaments/{data.tournament.id}</span></p></div>{data.viewerSignup && <div className="rounded-2xl border border-white/10 bg-black/15 px-5 py-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Your status</p><p className={`mt-1 font-bold capitalize ${kicked ? "text-rose-200" : "text-white"}`}>{data.viewerEliminated ? "Eliminated" : data.viewerSignup.status} · {data.viewerSignup.split}</p>{data.runtime?.presence?.warningStage > 0 && !kicked && <p className="mt-1 text-xs text-amber-200">Inactivity warning stage {data.runtime.presence.warningStage}/3</p>}</div>}</div>
    </section>

    {kicked && <section className="rounded-[2rem] border border-rose-400/25 bg-rose-400/[0.07] p-6"><p className="flex items-center gap-2 font-bold text-rose-100"><ShieldAlert size={17} />Removed for inactivity</p><p className="mt-2 text-sm leading-6 text-rose-100/80">Your tournament heartbeat was absent for 10 minutes. Your matchup was forfeited so the bracket could continue. You can still watch the public bracket and finals.</p></section>}

    {viewerAccepted && !data.viewerEliminated && current ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6 shadow-glow sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-accent"><Swords size={14} /> Your match · Round {current.round}</p><h2 className="mt-2 text-2xl font-bold text-white">{currentTeam ? <TeamLabel team={currentTeam} /> : "Your team"} <span className="mx-2 text-muted">vs</span> {opponent ? <TeamLabel team={opponent} /> : "Waiting for opponent"}</h2></div>{phaseLabel && <span className="rounded-full border border-white/10 bg-black/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted">{phaseLabel}</span>}</div>
      <PhaseCard current={current} />

      {current.status === "map_ready" && current.map && <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center">{current.map.imageUrl && <img src={current.map.imageUrl} alt="" className="h-28 w-full rounded-2xl object-cover md:w-40" />}<div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Map revealed · load it now</p><h3 className="mt-1 truncate text-xl font-bold text-white">{current.map.title}</h3><p className="mt-1 text-sm text-muted">{current.map.artist || ""}{current.map.rating != null ? ` · ${Number(current.map.rating).toFixed(2)}★` : ""}</p></div>{current.map.mapFileUrl && <a href={current.map.mapFileUrl} className="ui-button border border-white/10 bg-white/5 text-white"><Download size={16} />Map</a>}</div>{current.playStartsAt && <p className="mt-4 text-center text-sm text-amber-100">Play window opens in <span className="font-black text-white"><Countdown deadline={current.playStartsAt} /></span>. Scores played before this stage may not be the recent score you intend to submit.</p>}</div>}

      {current.status === "active" && current.map && <div className="mt-6 rounded-3xl border border-accent/20 bg-accent/[0.045] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center">{current.map.imageUrl && <img src={current.map.imageUrl} alt="" className="h-28 w-full rounded-2xl object-cover md:w-40" />}<div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Play now · tournament map</p><h3 className="mt-1 truncate text-xl font-bold text-white">{current.map.title}</h3><p className="mt-1 text-sm text-muted">{current.map.artist || ""}{current.map.rating != null ? ` · ${Number(current.map.rating).toFixed(2)}★` : ""}</p>{current.battleMatchId && <p className="mt-2 text-xs text-muted">Battle ID: <span className="font-mono text-white">{current.battleMatchId}</span></p>}</div><div className="flex flex-wrap gap-2">{current.map.mapFileUrl && <a href={current.map.mapFileUrl} className="ui-button border border-white/10 bg-white/5 text-white"><Download size={16} />Map</a>}<button disabled={working || submitted} onClick={() => void action("check-score")} className="ui-button bg-accent text-white disabled:opacity-45">{working ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{submitted ? "Score locked" : "Submit recent score"}</button></div></div>{current.matchDeadlineAt && <p className="mt-4 rounded-xl border border-white/8 bg-black/10 p-3 text-sm text-muted">Score deadline: <span className="font-black text-white"><Countdown deadline={current.matchDeadlineAt} /></span>. If you do not submit, the runtime records a warning and resolves the matchup automatically.</p>}<button onClick={() => setConfirmForfeit(true)} className="mt-4 rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200">Forfeit match</button></div>}

      {current.status === "needs_admin" && <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5"><p className="flex items-center gap-2 font-semibold text-amber-100"><ShieldAlert size={17} />Runtime exception</p><p className="mt-1 text-sm text-amber-100/80">Normal missed-score and inactivity cases resolve automatically. This state is reserved for corrupt or incomplete match data that genuinely needs admin intervention.</p></div>}
    </section> : viewerAccepted && data.viewerEliminated ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-8 text-center"><Trophy className="mx-auto text-muted" size={28} /><h2 className="mt-3 text-2xl font-bold text-white">Your tournament run is complete</h2><p className="mt-2 text-sm text-muted">Stay here to watch both brackets and the featured finals finish.</p></section> : data.tournament.status !== "completed" && !kicked ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-7 text-center"><p className="text-sm text-muted">You are viewing the public live bracket.</p></section> : null}

    {message && <p className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4 text-sm text-white">{message}</p>}

    <TournamentFinalsSpotlight matches={data.matches} />

    {(viewerAccepted || kicked) && <TournamentSplitChat tournamentId={tournamentId} />}

    <TournamentBracket matches={data.matches} split="lower" mode={data.mode} />
    <TournamentBracket matches={data.matches} split="higher" mode={data.mode} />

    {data.tournament.status === "completed" && <section className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.05] p-7 text-center"><Trophy className="mx-auto text-amber-200" size={30} /><h2 className="mt-3 text-2xl font-black text-white">Tournament complete</h2><p className="mt-2 text-sm text-muted">This event is now archived. The brackets, final scores, maps, and champions remain available from the main tournament page.</p></section>}

    {confirmForfeit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101629] p-7 shadow-2xl"><h2 className="text-xl font-bold text-white">Forfeit this tournament match?</h2><p className="mt-2 text-sm leading-6 text-muted">Your opposing team immediately advances and your team is eliminated from this split.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmForfeit(false)} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-white">Cancel</button><button disabled={working} onClick={() => void action("forfeit")} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Confirm forfeit</button></div></div></div>}
  </div>;
}
