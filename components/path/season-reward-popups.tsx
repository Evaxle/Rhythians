"use client";

import { useEffect, useState } from "react";
import { Check, Trophy } from "lucide-react";

export function SeasonRewardPopups() {
  const [rewards, setRewards] = useState<Array<{ seasonNumber: number; rankIndex: number; rankName: string; color: string }>>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/seasonal-path/rewards", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.rewards)) setRewards(data.rewards);
    }).catch(() => {});
  }, []);

  if (rewards.length === 0 || index >= rewards.length) return null;
  const reward = rewards[index];

  async function claim() {
    setBusy(true);
    try {
      const response = await fetch("/api/seasonal-path/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasonNumber: reward.seasonNumber, rankIndex: reward.rankIndex }) });
      if (!response.ok) return;
      setIndex((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl animate-modal-in" style={{ boxShadow: `0 30px 100px ${reward.color}28` }}><div className="h-1.5" style={{ background: reward.color }} /><div className="p-7 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border" style={{ borderColor: `${reward.color}70`, backgroundColor: `${reward.color}16`, color: reward.color }}><Trophy size={36} /></div><p className="mt-5 text-xs uppercase tracking-[0.28em] text-muted">Season reward</p><h2 className="mt-3 text-3xl font-semibold text-white">You earned</h2><p className="mt-3 text-xl font-bold" style={{ color: reward.color }}>Season {reward.seasonNumber} {reward.rankName}</p><p className="mt-3 text-sm leading-6 text-muted">You reached {reward.rankName} on the seasonal path. Claim this rank title to add it to your profile.</p><button type="button" disabled={busy} onClick={() => void claim()} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: reward.color }}><Check size={17} /> {busy ? "Claiming..." : "Claim"}</button><p className="mt-4 text-xs text-muted">Reward {index + 1} of {rewards.length}</p></div></div></div>;
}
