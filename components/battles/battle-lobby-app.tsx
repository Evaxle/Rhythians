"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Crown, Send, Swords, Users } from "lucide-react";

const modes = ["1v1", "2v2", "3v3", "15v15"];

export function BattleLobbyApp({ lobbyId }: { lobbyId: string }) {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  async function load() {
    const response = await fetch(`/api/battles/lobbies/${lobbyId}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setData(result); else setError(result.error ?? "Lobby unavailable.");
  }

  useEffect(() => { load(); const timer = setInterval(load, 2500); return () => clearInterval(timer); }, [lobbyId]);

  async function action(actionName: string, extra: Record<string, string> = {}) {
    const response = await fetch(`/api/battles/lobbies/${lobbyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, ...extra }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Action failed."); else { setError(""); if (result.matchId) window.location.href = `/battles/match/${result.matchId}`; else await load(); }
  }

  async function sendMessage() { if (!message.trim()) return; await action("message", { content: message }); setMessage(""); }
  async function start() { setStarting(true); await action("start"); setStarting(false); }

  if (!data) return <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-surface/95 p-10 text-center text-muted">Loading lobby...</div>;
  const lobby = data.lobby;
  const members = data.members ?? [];
  const votes = data.votes ?? [];
  const mapIds = ["random", ...votes.map((vote: any) => vote.mapId)];
  const required = Number(String(lobby.mode).split("v")[0]) * 2;

  return <div className="mx-auto max-w-7xl space-y-5"><section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.22em] text-accent">Party lobby</p><h1 className="mt-2 text-3xl font-semibold text-white">{lobby.name}</h1><p className="mt-1 text-sm text-muted">Hosted by {lobby.host} · {lobby.playerCount ?? members.length}/{lobby.maxPlayers} players</p></div><Link href="/battles" className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-white">Back to battles</Link></div></section><section className="grid min-h-[36rem] gap-4 lg:grid-cols-[18rem_1fr_24rem]"><aside className="rounded-3xl border border-border bg-surface/95 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-white">Players</h2><span className="text-xs text-muted">{members.length}/{lobby.maxPlayers}</span></div><div className="mt-4 space-y-2">{members.map((member: any) => <Link href={`/profile/${encodeURIComponent(member.profileHandle)}`} key={member.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent/10 text-accent">{member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : <Users size={15} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{member.displayName ?? member.username}</p><p className="text-[10px] text-muted">{member.isHost ? "Host" : member.isReady ? "Ready" : "Not ready"}</p></div>{member.isHost && <Crown size={14} className="text-yellow-300" />}</Link>)}</div><button onClick={() => action("ready")} className="mt-4 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-white hover:border-accent/40"><Check className="mr-1 inline" size={15} />Toggle ready</button></aside><main className="rounded-3xl border border-border bg-surface/95 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-accent">Match setup</p><h2 className="mt-1 text-xl font-semibold text-white">{lobby.mode} casual battle</h2></div><span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Needs {required} players</span></div><div className="mt-5 grid grid-cols-2 gap-2">{modes.map((item) => <button key={item} onClick={() => action("mode", { mode: item })} className={`rounded-xl border p-3 text-left text-sm font-semibold ${lobby.mode === item ? "border-accent bg-accent/10 text-white" : "border-border text-muted hover:text-white"}`}>{item}</button>)}</div><div className="mt-5 rounded-2xl border border-border bg-background/40 p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted">Map queue</p><p className="mt-2 text-sm text-white">Players can vote for maps here. The host starts the selected battle when the party is ready.</p><div className="mt-4 flex flex-wrap gap-2">{mapIds.map((mapId: string) => <button key={mapId} onClick={() => action("vote", { mapId })} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-white">{mapId === "random" ? "Random map" : `Map ${mapId.slice(0, 8)}`}</button>)}</div></div><button disabled={starting || members.length !== required} onClick={start} className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"><Swords className="mr-2 inline" size={16} />Start match</button>{error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}</main><aside className="flex min-h-0 flex-col rounded-3xl border border-border bg-surface/95 p-5"><h2 className="font-semibold text-white">Lobby chat</h2><div className="mt-4 flex-1 space-y-3 overflow-y-auto">{data.messages?.map((item: any) => <div key={item.id}><p className="text-xs font-semibold text-white">{item.username}</p><p className="mt-0.5 text-sm leading-5 text-muted">{item.content}</p></div>)}</div><form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/50 p-2"><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message lobby..." className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none" /><button className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white"><Send size={15} /></button></form></aside></section></div>;
}
