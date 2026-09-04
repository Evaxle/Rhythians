"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Download, Loader2, Shield, Swords, Trophy, UserRound } from "lucide-react";
import { getRankInfo, rankLabel } from "@/lib/ranks";
import { CasualMapSelection } from "@/components/battles/casual-map-selection";

function Avatar({ player, large = false }: { player: any; large?: boolean }) {
  const size = large ? "h-20 w-20" : "h-12 w-12";
  if (player?.avatar) {
    return <img src={player.avatar} alt={player.username} className={`${size} rounded-full border border-white/10 object-cover`} />;
  }
  return <div className={`${size} flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted`}><UserRound size={large ? 28 : 18} /></div>;
}

function Clock({ deadline }: { deadline?: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor(((deadline ? new Date(deadline).getTime() : now) - now) / 1000));
  return <span className="tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>;
}

export function BattleMatchApp({ matchId }: { matchId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function load() {
    try {
      const response = await fetch(`/api/battles/matches?id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Battle not found.");
      setData(result);
      setError("");
      if (result.match.status === "queue") window.location.href = `/battles/match/${matchId}/finding`;
      if (result.match.status === "finished") window.location.href = `/battles/match/${matchId}/results`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the battle.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 1000);
    return () => clearInterval(timer);
  }, [matchId]);

  async function accept() {
    setAccepting(true);
    try {
      const response = await fetch("/api/battles/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", matchId }),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? "Could not accept battle.");
      else await load();
    } catch {
      setError("Could not accept battle.");
    } finally {
      setAccepting(false);
    }
  }

  async function checkScore() {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/battles/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-score", matchId }),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? "Could not check your score.");
      await load();
    } catch {
      setError("Could not check your score.");
    } finally {
      setChecking(false);
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      const response = await fetch("/api/battles/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forfeit", matchId }),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? "Could not leave the battle.");
      else window.location.href = `/battles/match/${matchId}/results`;
    } catch {
      setError("Could not leave the battle.");
    } finally {
      setLeaving(false);
    }
  }

  if (loading) return <div className="ui-page flex min-h-[60vh] items-center justify-center text-muted"><Loader2 className="mr-2 animate-spin" />Loading battle...</div>;
  if (!data) return <div className="ui-page max-w-3xl"><section className="ui-card rounded-[2rem] p-10 text-center text-red-300">{error || "Battle unavailable."}</section></div>;

  const players = data.players ?? [];
  const teamOne = players.filter((player: any) => player.team === 1);
  const teamTwo = players.filter((player: any) => player.team === 2);
  const viewer = players.find((player: any) => player.userId === data.viewerId);
  const mode = String(data.match.mode ?? "1v1").split(":")[0];
  const active = data.match.status === "active";
  const canAccept = data.match.status === "invite" && viewer?.team === 2;
  const submitted = viewer?.accuracy != null;
  const responseStarted = Boolean(data.match.responseDeadlineAt);
  const disconnected = (data.disconnected ?? []).find((entry: any) => entry.userId !== data.viewerId);
  const rankTitle = viewer ? rankLabel(getRankInfo(Number(viewer.rhp))) : "";

  function Team({ team, name }: { team: any[]; name: string }) {
    return (
      <section className="ui-card rounded-[2rem] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">{name}</p>
            <p className="mt-1 text-[11px] text-muted">{team.length} players</p>
          </div>
          <Trophy size={18} className="text-accent" />
        </div>
        <div className={mode === "15v15" ? "grid grid-cols-2 gap-2 xl:grid-cols-3" : "space-y-2"}>
          {team.map((player: any) => {
            const rank = getRankInfo(Number(player.rhp));
            return (
              <Link
                href={`/profile/${encodeURIComponent(player.profileHandle)}`}
                key={player.userId}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 transition hover:border-accent/25"
              >
                <Avatar player={player} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{player.displayName ?? player.username}</p>
                  <p className="mt-1 text-[11px] font-semibold" style={{ color: rank.color }}>{rankLabel(rank)}</p>
                </div>
                <span className="text-sm font-black text-white">
                  {player.accuracy != null ? `${Number(player.accuracy).toFixed(2)}%` : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="ui-page space-y-5">
      <section className="rounded-[2rem] border border-accent/15 bg-surface/95 p-6 shadow-glow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-accent"><Swords size={15} />{data.match.matchType} battle</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{mode}</h1>
            <p className="mt-1 text-sm text-muted">{active ? "Compete on the same map and submit your latest Rhythia score." : data.match.status === "invite" ? "Your opponent sent a challenge." : "Preparing the battle."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/15 px-3 py-2 text-xs font-semibold text-muted">
              Your rank: <span style={{ color: viewer ? getRankInfo(Number(viewer.rhp)).color : undefined }}>{rankTitle}</span>
            </span>
            {active && responseStarted && <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">Response <Clock deadline={data.match.responseDeadlineAt} /></span>}
            <button onClick={() => setConfirmLeave(true)} disabled={!active} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-30">Leave battle</button>
          </div>
        </div>
      </section>

      {disconnected && active && (
        <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Your opponent disconnected. Reconnect is available for <Clock deadline={disconnected.until} />.
        </section>
      )}

      {canAccept && (
        <section className="ui-card rounded-[2rem] p-8 text-center">
          <Avatar player={teamTwo[0]} large />
          <h2 className="mt-4 text-2xl font-semibold text-white">{teamTwo[0]?.displayName ?? teamTwo[0]?.username}</h2>
          <button disabled={accepting} onClick={accept} className="mt-5 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
            {accepting ? <Loader2 className="animate-spin" size={17} /> : <><Check className="mr-2 inline" size={17} />Accept battle</>}
          </button>
        </section>
      )}

      {data.match.status === "map_vote" ? (
        <CasualMapSelection data={data} matchId={matchId} onRefresh={load} />
      ) : active ? (
        <>
          <section className="grid gap-5 lg:grid-cols-[1fr_auto_1fr]">
            <Team team={teamOne} name="Team 1" />
            <div className="flex items-center justify-center text-3xl font-black italic text-muted">VS</div>
            <Team team={teamTwo} name="Team 2" />
          </section>

          {data.map && (
            <section className="ui-card rounded-[2rem] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                {data.map.imageUrl && <img src={data.map.imageUrl} alt="" className="h-24 w-full rounded-2xl object-cover md:w-32" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Battle map</p>
                  <h2 className="mt-1 truncate text-xl font-semibold text-white">{data.map.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {data.map.artist ?? ""}
                    {data.map.rating != null ? ` · ${Number(data.map.rating).toFixed(2)}★` : ""}
                    {data.map.length != null ? ` · ${Math.floor(Number(data.map.length) / 60)}:${String(Math.floor(Number(data.map.length) % 60)).padStart(2, "0")}` : ""}
                  </p>
                </div>
                {data.map.mapFileUrl && (
                  <a href={data.map.mapFileUrl} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"><Download size={16} />Download</a>
                )}
                <button
                  disabled={checking || submitted || Boolean(data.match.responseDeadlineAt && new Date(data.match.responseDeadlineAt).getTime() <= Date.now())}
                  onClick={checkScore}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {checking ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  {submitted ? "Score submitted" : "Check score"}
                </button>
              </div>
              {submitted && <p className="mt-4 text-sm text-emerald-300">Your score is locked at {Number(viewer.accuracy).toFixed(2)}%. {data.match.matchType === "ranked" ? "Your +10 RBP submit bonus is recorded." : "Waiting for the remaining players."}</p>}
              {responseStarted && active && <p className="mt-4 text-sm text-muted">The battle ends when everyone submits or the response timer reaches <Clock deadline={data.match.responseDeadlineAt} />.</p>}
            </section>
          )}
        </>
      ) : (
        <section className="ui-card rounded-[2rem] p-8 text-center">
          <Shield className="mx-auto text-muted" size={34} />
          <p className="mt-4 text-sm text-muted">{data.match.status === "queue" ? "Finding an opponent..." : "Waiting for the other players."}</p>
        </section>
      )}

      {error && <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}

      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101629] p-7 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">Leave ranked battle?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Confirming will forfeit the battle. In ranked, you lose 10 RBP and your opponent receives 10 RBP. Closing the page without confirming only starts the one-minute reconnect window.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirmLeave(false)} className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white">Nevermind</button>
              <button disabled={leaving} onClick={() => void leave()} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{leaving ? <Loader2 className="animate-spin" size={16} /> : "Confirm forfeit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
