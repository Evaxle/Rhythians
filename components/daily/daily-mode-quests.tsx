"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Gift, RefreshCw } from "lucide-react";

type Mode = "lock" | "spin" | "vr";
type Quest = {
  id: string;
  mode: Mode;
  map: { id: string; title: string; artist: string | null; mapperName: string | null; imageUrl: string | null; sourceUrl: string | null; mapFileUrl: string; rating: number };
  basePoints: number;
  boostedPoints: number;
  bonusPoints: number;
  detected: boolean;
  claimed: boolean;
  claimLocked: boolean;
};

const labels: Record<Mode, { name: string; points: string }> = {
  lock: { name: "Lock", points: "RPL" },
  spin: { name: "Spin", points: "RPS" },
  vr: { name: "VR", points: "RPV" },
};

export function DailyModeQuests({ initialQuests }: { initialQuests: Quest[] }) {
  const router = useRouter();
  const [quests, setQuests] = useState(initialQuests);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState("");
  const [message, setMessage] = useState("");

  async function check() {
    if (checking) return;
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/daily/quests", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to check quest scores.");
      setQuests(data.quests ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check quest scores.");
    } finally {
      setChecking(false);
    }
  }

  async function claim(questId: string) {
    setClaiming(questId);
    setMessage("");
    try {
      const response = await fetch("/api/daily/quests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to claim quest.");
      setQuests(data.quests ?? []);
      setMessage(`Quest claimed: +${data.bonusPoints} ${labels[data.mode as Mode].points} bonus from the 1.3× boost.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to claim quest.");
    } finally {
      setClaiming("");
    }
  }

  useEffect(() => {
    void check();
    const interval = window.setInterval(() => void check(), 90_000);
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, []);

  return <section className="ui-card rounded-[2rem] p-5 shadow-glow sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-accent"><Gift size={15} /> Daily mode quests</p><h2 className="mt-2 text-2xl font-semibold text-white">Choose one 1.3× quest boost</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Beat one of today&apos;s three quest maps in its listed camera mode. After Rhythians detects the passing score, claim that quest to add the extra 30% to its RPL, RPS, or RPV reward. Only one quest can be claimed each day.</p></div><button type="button" onClick={() => void check()} disabled={checking} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={14} className={checking ? "animate-spin" : ""} />{checking ? "Checking..." : "Check scores"}</button></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-3">{quests.map((quest) => {
      const label = labels[quest.mode];
      return <article key={quest.id} className={`overflow-hidden rounded-3xl border ${quest.claimed ? "border-emerald-400/35 bg-emerald-400/[0.05]" : "border-white/10 bg-black/15"}`}>
        {quest.map.imageUrl && <img src={quest.map.imageUrl} alt="" className="aspect-[16/7] w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
        <div className="p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">{label.name} · {label.points}</span><span className="text-sm font-bold text-white">{quest.map.rating.toFixed(2)}</span></div><h3 className="mt-3 line-clamp-2 text-base font-semibold text-white">{quest.map.title}</h3><p className="mt-1 text-xs text-muted">{quest.map.artist ?? "Unknown artist"} · {quest.map.mapperName ?? "Unknown mapper"}</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/10 bg-black/15 p-3"><p className="text-[10px] uppercase tracking-wider text-muted">Normal reward</p><p className="mt-1 text-lg font-bold text-white">{quest.basePoints} {label.points}</p></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3"><p className="text-[10px] uppercase tracking-wider text-muted">Quest reward</p><p className="mt-1 text-lg font-bold text-emerald-300">{quest.boostedPoints} {label.points}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{quest.map.sourceUrl && <a href={quest.map.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white"><ExternalLink size={13} /> Rhythia</a>}<button type="button" onClick={() => void claim(quest.id)} disabled={!quest.detected || quest.claimLocked || quest.claimed || Boolean(claiming)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{quest.claimed ? <><CheckCircle2 size={14} /> Claimed</> : claiming === quest.id ? <><RefreshCw size={14} className="animate-spin" /> Claiming...</> : quest.claimLocked ? "Another quest claimed" : quest.detected ? "Claim 1.3× boost" : "Pass not detected"}</button></div></div>
      </article>;
    })}</div>
    {quests.length === 0 && <p className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm text-amber-100">Quest maps will appear after the ranked-map analyzer has eligible maps available.</p>}
    {message && <p className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3 text-sm text-white">{message}</p>}
  </section>;
}
