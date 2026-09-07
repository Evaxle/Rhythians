"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

export function SignedUpRoster({ signups }: { signups: any[] }) {
  const active = (signups ?? []).filter((entry) => !["withdrawn", "kicked"].includes(String(entry.status)));
  if (!active.length) return null;
  return <section className="rounded-[2rem] border border-white/10 bg-surface/95 p-6"><div className="flex items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent"><Users size={15} /> Signed-up players</p><h2 className="mt-2 text-2xl font-black text-white">{active.length} players registered</h2></div></div><div className="mt-5 grid gap-5 lg:grid-cols-2">{(["lower","higher"] as const).map((split) => <div key={split}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold capitalize text-white">{split} split</h3><span className="text-xs text-muted">{active.filter((entry) => entry.split === split).length}</span></div><div className="grid gap-2 sm:grid-cols-2">{active.filter((entry) => entry.split === split).map((entry) => <Link key={entry.userId} href={`/profile/${entry.profileHandle ?? entry.username}`} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/15 p-3 transition hover:border-accent/25"><UserAvatar src={entry.avatarUrl ?? entry.avatar} discordId={entry.discordId} name={entry.displayName ?? entry.username} className="h-9 w-9" /><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{entry.displayName ?? entry.username}</p><p className="truncate text-xs text-muted">@{entry.username} · {entry.rankName}</p></div></Link>)}</div></div>)}</div></section>;
}