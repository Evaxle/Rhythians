"use client";

import { useState } from "react";
import { Swords } from "lucide-react";

export function ProfileBattleButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function challenge(matchType: "casual" | "ranked") {
    setLoading(true); setError("");
    const response = await fetch("/api/battles/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite", opponentId: userId, mode: "1v1", matchType }) });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) { setError(result.error ?? "Could not send battle request."); return; }
    window.location.href = `/battles/match/${result.matchId}`;
  }
  return <div className="relative"><button onClick={() => setOpen((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"><Swords size={16} /> 1v1 Battle</button>{open && <div className="absolute right-0 z-20 mt-2 w-44 rounded-2xl border border-border bg-surface p-2 shadow-2xl"><button disabled={loading} onClick={() => challenge("casual")} className="w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/5">Casual</button><button disabled={loading} onClick={() => challenge("ranked")} className="w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/5">Ranked</button>{error && <p className="px-2 py-2 text-xs text-red-300">{error}</p>}</div>}</div>;
}
