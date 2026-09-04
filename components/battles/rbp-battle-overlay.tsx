"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function RbpBattleOverlay({ matchId }: { matchId: string }) {
  const [data, setData] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [working, setWorking] = useState(false);

  async function load() {
    const response = await fetch(`/api/battles/matches?id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }

  async function post(action: string) {
    return fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, matchId }), keepalive: action === "disconnect" });
  }

  function disconnect() {
    const body = JSON.stringify({ action: "disconnect", matchId });
    try { navigator.sendBeacon("/api/battles/matches", new Blob([body], { type: "application/json" })); } catch { void post("disconnect"); }
  }

  useEffect(() => {
    void post("reconnect");
    void load();
    const timer = setInterval(() => { setNow(Date.now()); void load(); }, 1000);
    const heartbeat = setInterval(() => { void post("heartbeat"); }, 5000);
    window.addEventListener("pagehide", disconnect);
    return () => { clearInterval(timer); clearInterval(heartbeat); window.removeEventListener("pagehide", disconnect); };
  }, [matchId]);

  useEffect(() => {
    if (data?.match?.status !== "active") return;
    const warning = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warning);
    return () => window.removeEventListener("beforeunload", warning);
  }, [data?.match?.status]);

  async function confirmForfeit() {
    setWorking(true);
    const response = await post("forfeit");
    if (response.ok) window.location.href = `/battles/match/${matchId}/results`;
    setWorking(false);
  }

  if (!data?.match || data.match.status !== "active") return null;
  const reconnect = (data.disconnected ?? []).find((entry: any) => entry.userId === data.viewerId);
  const opponent = (data.disconnected ?? []).find((entry: any) => entry.userId !== data.viewerId);
  const reconnectSeconds = reconnect ? Math.max(0, Math.floor((new Date(reconnect.until).getTime() - now) / 1000)) : 0;
  const opponentSeconds = opponent ? Math.max(0, Math.floor((new Date(opponent.until).getTime() - now) / 1000)) : 0;
  const responseSeconds = data.match.responseDeadlineAt ? Math.max(0, Math.floor((new Date(data.match.responseDeadlineAt).getTime() - now) / 1000)) : 0;
  const submitted = data.players?.find((player: any) => player.userId === data.viewerId)?.accuracy != null;
  const timerLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return <>{(reconnect || opponent || responseSeconds > 0) && <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#101629]/95 p-3 shadow-2xl backdrop-blur-xl"><div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-white">{reconnect ? `Reconnect window ${timerLabel(reconnectSeconds)}` : opponent ? `Opponent reconnects in ${timerLabel(opponentSeconds)}` : submitted ? `Opponent response ${timerLabel(responseSeconds)}` : `Response window ${timerLabel(responseSeconds)}`}</span><button onClick={() => setConfirmLeave(true)} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-200">Leave</button></div></div>}{confirmLeave && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101629] p-7 shadow-2xl"><h2 className="text-xl font-semibold text-white">Confirm forfeit</h2><p className="mt-2 text-sm leading-6 text-muted">Leaving this active battle is a forfeit. Ranked battles cost 10 RBP and award 10 RBP to the opponent. Closing the page without confirming only starts a one-minute reconnect window.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmLeave(false)} className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white">Nevermind</button><button disabled={working} onClick={() => void confirmForfeit()} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{working ? <Loader2 className="animate-spin" size={16} /> : "Confirm"}</button></div></div></div>}</>;
}
