"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, CheckCircle2, Crown, Gamepad2, Loader2, Map, MessageCircle, Radio, ShieldQuestion, Swords, Trophy, Users } from "lucide-react";
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

function MapPool({ maps, split }: { maps: any[]; split: "lower" | "higher" }) {
  const pool = maps.filter((map) => map.split === split);
  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{split} split</p><h3 className="mt-1 text-lg font-bold text-white">Ranked map pool</h3></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">{pool.length} maps</span></div>
      <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {pool.map((map) => <div key={map.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3"><div className="min-w-0"><p className="truncate font-semibold text-white">{map.title}</p><p className="mt-1 truncate text-xs text-muted">{map.artist || "Unknown artist"}</p></div><div className="shrink-0 text-right text-xs text-muted"><p>{map.rating != null ? `${Number(map.rating).toFixed(2)}★` : "Ranked"}</p>{map.length != null && <p className="mt-1">{Math.floor(Number(map.length) / 60)}:{String(Number(map.length) % 60).padStart(2, "0")}</p>}</div></div>)}
        {!pool.length && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">No ranked maps have been published to this split yet.</div>}
      </div>
    </div>
  );
}

export function TournamentsApp() {
  const [data, setData] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [streamOptIn, setStreamOptIn] = useState(false);
  const [streamPlatform, setStreamPlatform] = useState<"steam" | "nightly">("steam");
  const [streamIdentity, setStreamIdentity] = useState<"discord" | "rhythia">("rhythia");

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
  const eligibility = scheduled?.viewerEligibility;
  const streamReady = !streamOptIn || streamPlatform === "nightly" ? !streamOptIn || Boolean(eligibility?.discordInGuild) : streamIdentity === "discord" ? Boolean(eligibility?.discordLinked) : Boolean(eligibility?.rhythiaVerified);
  const canSignUp = Boolean(eligibility?.canSignUp) && streamReady;

  function choosePlatform(platform: "steam" | "nightly") {
    setStreamPlatform(platform);
    if (platform === "nightly") setStreamIdentity("discord");
    else if (!eligibility?.rhythiaVerified && eligibility?.discordLinked) setStreamIdentity("discord");
    else setStreamIdentity("rhythia");
  }

  return (
    <div className="ui-page space-y-6">
      <section className="overflow-hidden rounded-[2.4rem] border border-accent/20 bg-surface/95 p-7 shadow-glow sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-accent"><Trophy size={15} /> Rhythians tournaments</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">Compete through a full bracket.</h1>
            <p className="mt-5 text-sm leading-7 text-muted sm:text-base">The tournaments are split into two skill groups. <span className="font-semibold text-white">Lower</span> contains Copper, Bronze, Silver, Gold, Platinum, and Diamond. <span className="font-semibold text-white">Higher</span> contains Emerald, Master, and Expert. If your current rank does not represent the split you should compete in, sign up first and submit a split change request for admin review.</p>
          </div>
          <div className="grid min-w-[260px] gap-2 rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-muted"><p className="flex items-center gap-2"><Swords size={16} className="text-accent" /> Separate Lower and Higher brackets</p><p className="flex items-center gap-2"><Users size={16} className="text-accent" /> 1v1, 2v2, and 3v3 formats</p><p className="flex items-center gap-2"><ShieldQuestion size={16} className="text-accent" /> Admin-reviewed split changes</p></div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-fuchsia-400/20 bg-fuchsia-400/[0.055] p-6 shadow-glow sm:p-7">
        <div className="text-center"><Radio className="mx-auto text-fuchsia-200" size={28} /><p className="mt-3 text-xs font-black uppercase tracking-[0.26em] text-fuchsia-200">Live stream participation</p><h2 className="mx-auto mt-2 max-w-4xl text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">This notice is specifically for players who want their tournament matches shown on the live stream</h2><p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-muted">Live stream participation is <span className="font-black text-white">NOT required</span> to enter the tournament. These identity requirements only determine whether your match can be selected for the scheduled tournament broadcast.</p></div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black/15 p-5"><p className="flex items-center gap-2 text-sm font-bold text-white"><Gamepad2 size={17} className="text-accent" /> Steam Rhythia Users</p><p className="mt-3 text-sm leading-6 text-muted">A verified linked Rhythia account is required to enter the tournament. For live stream identification, Steam players may use their connected Discord account or their verified linked Rhythia account. Steam players without Discord can use the verified Rhythia identity.</p></div>
          <div className="rounded-3xl border border-white/10 bg-black/15 p-5"><p className="flex items-center gap-2 text-sm font-bold text-white"><MessageCircle size={17} className="text-accent" /> Nightly Rhythia Players</p><p className="mt-3 text-sm leading-6 text-muted">Nightly players who want live stream coverage must have a connected Discord account and that account must currently be inside the Rhythians Discord server. The server verifies membership before the signup is accepted.</p></div>
        </div>
      </section>

      {active && active.viewerSignup?.status !== "accepted" && <section className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[0.06] p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Tournament live</p><div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold text-white">{active.tournament.name}</h2><p className="mt-1 text-sm text-muted">The bracket is currently in progress.</p></div><Link href={`/tournaments/${active.tournament.id}`} className="ui-button bg-accent text-white">View live bracket</Link></div></section>}

      {scheduled ? <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6 shadow-glow sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><CalendarClock size={15} /> Next tournament</p><h2 className="mt-2 text-3xl font-bold text-white">{scheduled.tournament.name}</h2><p className="mt-2 text-sm text-muted">{scheduled.mode} · scheduled {new Date(scheduled.tournament.scheduledAt).toLocaleString()}</p></div>
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.06] px-6 py-4 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Scheduled countdown</p><p className="mt-1 text-2xl font-black text-white"><Countdown date={scheduled.tournament.scheduledAt} /></p></div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2"><CapCard label="Lower split" state={scheduled.caps.lower} teamSize={teamSize} /><CapCard label="Higher split" state={scheduled.caps.higher} teamSize={teamSize} /></div>
        <div className="mt-6 rounded-3xl border border-white/10 bg-black/10 p-5 sm:p-6">
          {!signup || signup.status === "withdrawn" ? <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-lg font-bold text-white">Sign up for {scheduled.tournament.name}</p><p className="mt-1 text-sm text-muted">Your starting split is assigned from your verified current Rhythians rank.</p></div>{eligibility?.rhythiaVerified ? <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"><BadgeCheck size={14} /> Verified Rhythia: {eligibility.rhythiaUsername}</span> : <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-200">Verified Rhythia account required</span>}</div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.05] p-4"><input type="checkbox" checked={streamOptIn} onChange={(event) => setStreamOptIn(event.target.checked)} className="mt-1 h-4 w-4 accent-fuchsia-400" /><span><span className="font-bold text-white">I want to be shown on the live stream for this tournament</span><span className="mt-1 block text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200">This is NOT required</span></span></label>
            <div className={`rounded-3xl border border-white/10 p-5 transition ${streamOptIn ? "bg-white/[0.025] opacity-100" : "pointer-events-none bg-black/20 opacity-35 grayscale"}`} aria-disabled={!streamOptIn}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Rhythia version</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => choosePlatform("steam")} className={`rounded-2xl border p-4 text-left transition ${streamPlatform === "steam" ? "border-accent/50 bg-accent/10" : "border-white/10 bg-black/15"}`}><p className="font-bold text-white">Rhythia Steam</p><p className="mt-1 text-xs text-muted">Discord or verified Rhythia identity</p></button><button type="button" onClick={() => choosePlatform("nightly")} className={`rounded-2xl border p-4 text-left transition ${streamPlatform === "nightly" ? "border-accent/50 bg-accent/10" : "border-white/10 bg-black/15"}`}><p className="font-bold text-white">Rhythia Nightly</p><p className="mt-1 text-xs text-muted">Discord + server membership required</p></button></div>
              {streamPlatform === "steam" ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Live stream identity</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setStreamIdentity("discord")} className={`rounded-2xl border p-4 text-left transition ${streamIdentity === "discord" ? "border-sky-400/50 bg-sky-400/10" : "border-white/10 bg-black/20 opacity-55"}`}><p className="flex items-center gap-2 font-semibold text-white"><MessageCircle size={15} /> Connected Discord</p><p className={`mt-1 text-xs ${eligibility?.discordLinked ? "text-emerald-200" : "text-rose-200"}`}>{eligibility?.discordLinked ? "Discord connected" : "No Discord connected"}</p></button><button type="button" onClick={() => setStreamIdentity("rhythia")} className={`rounded-2xl border p-4 text-left transition ${streamIdentity === "rhythia" ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10 bg-black/20 opacity-55"}`}><p className="flex items-center gap-2 font-semibold text-white"><BadgeCheck size={15} /> Verified Rhythia</p><p className={`mt-1 text-xs ${eligibility?.rhythiaVerified ? "text-emerald-200" : "text-rose-200"}`}>{eligibility?.rhythiaVerified ? eligibility.rhythiaUsername : "Not verified"}</p></button></div></div> : <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4"><p className="flex items-center gap-2 font-semibold text-white"><MessageCircle size={15} /> Connected Discord account</p><p className={`mt-2 text-sm ${eligibility?.discordInGuild ? "text-emerald-200" : "text-rose-200"}`}>{eligibility?.discordInGuild ? "Verified: your connected Discord account is in the Rhythians server." : eligibility?.discordLinked ? "Your Discord is connected, but server membership could not be verified." : "Connect Discord and join the Rhythians server before selecting Nightly livestream coverage."}</p></div>}
            </div>
            {!eligibility?.canSignUp && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">You cannot sign up until your linked Rhythia account is verified.</p>}
            {streamOptIn && !streamReady && <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">The selected livestream identity does not currently meet the requirements. You can turn livestream participation off and still enter the tournament.</p>}
            <button disabled={working || !canSignUp} onClick={() => void action("signup", scheduled.tournament.id, { streamOptIn, streamPlatform: streamOptIn ? streamPlatform : null, streamIdentity: streamOptIn ? streamIdentity : null })} className="ui-button w-full justify-center bg-accent text-white disabled:cursor-not-allowed disabled:opacity-40">{working ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}Sign Up</button>
          </div> : <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xl font-black text-emerald-200"><CheckCircle2 size={20} /> Signed Up</p><p className="mt-2 text-sm text-muted">Signed up {new Date(signup.signedUpAt).toLocaleString()} · tournament starts {new Date(scheduled.tournament.scheduledAt).toLocaleString()}</p><p className="mt-1 text-sm text-muted">Countdown: <span className="font-bold text-white"><Countdown date={scheduled.tournament.scheduledAt} /></span></p></div><button disabled={working} onClick={() => void action("withdraw", scheduled.tournament.id)} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-50">Withdraw</button></div>
            <div className="grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Your split</p><p className="mt-1 text-xl font-black capitalize text-white">{signup.split}</p><p className="mt-2 text-xs leading-5 text-muted">Ranks: {(scheduled.splitRanks?.[signup.split] ?? []).join(" · ")}</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Livestream</p><p className="mt-1 font-semibold text-white">{signup.streamOptIn ? `${signup.streamPlatform === "nightly" ? "Rhythia Nightly" : "Rhythia Steam"} · ${signup.streamIdentity === "discord" ? "Discord" : "Rhythia"}` : "Not opted in"}</p><p className="mt-2 text-xs text-muted">Livestream participation does not affect tournament acceptance.</p></div></div>
            <p className="text-sm text-muted">Tournament status: <span className="font-semibold capitalize text-white">{signup.status}</span>{signup.splitRequestStatus === "pending" ? ` · ${signup.requestedSplit} split request pending` : ""}</p>
            {scheduled.caps[signup.split]?.atRisk && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">This split is between secured bracket caps. You might not be accepted unless it reaches {scheduled.caps[signup.split].next} players.</p>}
            {signup.splitRequestStatus !== "pending" && <button disabled={working} onClick={() => void action("request-split", scheduled.tournament.id, { split: signup.split === "lower" ? "higher" : "lower" })} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Request {signup.split === "lower" ? "Higher" : "Lower"} split</button>}
          </div>}
        </div>
        <section className="mt-6 rounded-3xl border border-white/10 bg-black/10 p-5 sm:p-6"><div className="flex items-center gap-2"><Map size={18} className="text-accent" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Scheduled tournament maps</p><h3 className="mt-1 text-xl font-bold text-white">Ranked map pools</h3></div></div><p className="mt-2 text-sm text-muted">Only ranked maps can be added by tournament admins, and tournament battles only draw from the map pool for their own split.</p><div className="mt-5 grid gap-4 xl:grid-cols-2"><MapPool maps={scheduled.mapPool ?? []} split="lower" /><MapPool maps={scheduled.mapPool ?? []} split="higher" /></div></section>
      </section> : <section className="rounded-[2rem] border border-dashed border-white/10 bg-surface/60 p-10 text-center"><Trophy className="mx-auto text-muted" size={30} /><h2 className="mt-4 text-xl font-semibold text-white">No tournament is scheduled</h2><p className="mt-2 text-sm text-muted">The next signup period will appear here when an admin publishes a tournament.</p></section>}

      {message && <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{message}</p>}

      {recent && <div className="space-y-5"><section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6"><p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Most recent tournament</p><h2 className="mt-2 text-3xl font-bold text-white">{recent.tournament.name}</h2><p className="mt-2 text-sm text-muted">Final results remain here until the next tournament begins.</p><div className="mt-5 grid gap-3 md:grid-cols-2"><Champion label="Lower winner" team={recent.champions.lower} /><Champion label="Higher winner" team={recent.champions.higher} /></div></section><TournamentBracket matches={recent.matches} split="lower" mode={recent.mode} /><TournamentBracket matches={recent.matches} split="higher" mode={recent.mode} /></div>}
    </div>
  );
}
