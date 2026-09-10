"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RANKS } from "@/lib/ranks";

type Player = { id: string; username: string; displayName: string | null; profileHandle: string; rhp: number; rankIndex: number };

export function AdminRankManager({ players }: { players: Player[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const allIds = useMemo(() => players.map((player) => player.id), [players]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const grouped = useMemo(() => RANKS.map((rank, index) => ({ rank, index, players: players.filter((player) => player.rankIndex === index) })), [players]);

  function toggleSelected(userId: string) { setSelected((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]); }
  function toggleGroup(userIds: string[]) { setSelected((current) => userIds.every((id) => current.includes(id)) ? current.filter((id) => !userIds.includes(id)) : [...new Set([...current, ...userIds])]); }

  async function request(payload: Record<string, unknown>, key: string) {
    setSaving(key); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/users/rank", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update players.");
      if (payload.action === "replace-all-battle-ranks") setMessage(`Battle placement finished for Season ${result.seasonNumber}: ${result.changed ?? 0} users were placed from their current pass-only RHP.`);
      else setMessage(`Pass sync finished: ${result.changed ?? 0} updated, ${result.skipped ?? 0} skipped, ${result.failed ?? 0} failed.`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update players."); }
    finally { setSaving(null); }
  }

  async function syncPlayers(userIds: string[], key: string) {
    if (!userIds.length) return;
    await request({ userIds, action: "sync-passes" }, key);
    setSelected((current) => current.filter((id) => !userIds.includes(id)));
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Rank management</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Players by pass-only rank</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">RPL, RPV and RPS are read-only and come only from detected passes on eligible analyzed maps. RHP is always RPL + RPV + RPS. Rhythia RP, global rank, and manual point/rank overrides cannot change these values.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/50 p-3">
        <button onClick={() => void request({ action: "replace-all-battle-ranks" }, "battle-place-all")} disabled={saving !== null} className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50">{saving === "battle-place-all" ? "Placing battle ranks…" : "Place battle rank for all users"}</button>
        <button onClick={() => setSelected(allSelected ? [] : allIds)} disabled={!allIds.length || saving !== null} className="rounded-xl border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{allSelected ? "Deselect all users" : `Select all users (${players.length})`}</button>
        <button onClick={() => void syncPlayers(selected, "bulk-sync")} disabled={!selected.length || saving !== null} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">{saving === "bulk-sync" ? "Checking passes…" : "Recheck selected passes"}</button>
        <span className="text-sm text-muted">{selected.length} selected</span>
      </div>
    </div>
    {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {message && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}
    <div className="mt-6 space-y-5">{grouped.map(({ rank, players: rankPlayers }) => {
      const ids = rankPlayers.map((player) => player.id);
      const groupSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
      return <div key={rank.name} className="rounded-2xl border border-border bg-background/50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold" style={{ color: rank.color }}>{rank.name}</p><p className="text-xs text-muted">{rankPlayers.length} player{rankPlayers.length === 1 ? "" : "s"} · starts at {rank.minRhp.toLocaleString()} RHP</p></div>{rankPlayers.length > 0 && <button onClick={() => toggleGroup(ids)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white">{groupSelected ? "Deselect rank" : "Select rank"}</button>}</div>
        {rankPlayers.length === 0 ? <p className="mt-4 text-sm text-muted">No players at this rank.</p> : <div className="mt-4 space-y-2">{rankPlayers.map((player) => <div key={player.id} className="rounded-xl border border-border bg-surface/70 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={selected.includes(player.id)} onChange={() => toggleSelected(player.id)} className="h-4 w-4 accent-accent"/><span className="min-w-0"><span className="block truncate font-semibold text-white">{player.displayName ?? player.username}</span><span className="block truncate text-xs text-muted">@{player.profileHandle} · {player.rhp.toLocaleString()} RHP</span></span></label><button onClick={() => void syncPlayers([player.id], `sync:${player.id}`)} disabled={saving !== null} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">{saving === `sync:${player.id}` ? "Checking…" : "Recheck passes"}</button></div></div>)}</div>}
      </div>;
    })}</div>
  </section>;
}
