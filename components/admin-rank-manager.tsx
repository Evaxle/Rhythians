"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RANKS } from "@/lib/ranks";

type Player = {
  id: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  rhp: number;
  rankIndex: number;
};

export function AdminRankManager({ players }: { players: Player[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkRank, setBulkRank] = useState("0");
  const [rowRanks, setRowRanks] = useState<Record<string, string>>(() => Object.fromEntries(players.map((player) => [player.id, String(player.rankIndex)])));
  const [rowRhp, setRowRhp] = useState<Record<string, string>>(() => Object.fromEntries(players.map((player) => [player.id, String(player.rhp)])));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const grouped = useMemo(() => RANKS.map((rank, index) => ({ rank, index, players: players.filter((player) => player.rankIndex === index) })), [players]);

  function toggleSelected(userId: string) {
    setSelected((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  }

  function toggleGroup(userIds: string[]) {
    setSelected((current) => {
      const allSelected = userIds.every((id) => current.includes(id));
      return allSelected ? current.filter((id) => !userIds.includes(id)) : [...new Set([...current, ...userIds])];
    });
  }

  async function updatePlayers(userIds: string[], payload: Record<string, unknown>, key: string) {
    if (userIds.length === 0) return;
    setSaving(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/users/rank", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds, ...payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update player points.");
      setSelected((current) => current.filter((id) => !userIds.includes(id)));
      if (result.points) setMessage(`Applied Rhythia RP: ${result.points.rpl.toLocaleString()} RPL + ${result.points.rps.toLocaleString()} RPS + ${result.points.rpv.toLocaleString()} RPV = ${result.rhp.toLocaleString()} RHP.`);
      else setMessage(`Updated ${result.changed ?? userIds.length} player${(result.changed ?? userIds.length) === 1 ? "" : "s"} to ${Number(result.rhp ?? 0).toLocaleString()} RHP.`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update player points.");
    } finally {
      setSaving(null);
    }
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Rank management</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Players by rank</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">Set a rank or exact RHP. Rank changes rebalance RPL, RPS, and RPV while preserving the player's existing mode proportions, and RHP always equals RPL + RPS + RPV. Use RP reads the linked Rhythia profile's Lock, Spin, and VR RP and converts each to Rhythians points at 50%.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-sm text-muted">{selected.length} selected</span>
        <select value={bulkRank} onChange={(event) => setBulkRank(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-white">
          {RANKS.map((rank, index) => <option key={rank.name} value={index}>{rank.name} · {rank.minRhp.toLocaleString()} RHP</option>)}
        </select>
        <button onClick={() => void updatePlayers(selected, { action: "set-rank", rankIndex: Number(bulkRank) }, "bulk")} disabled={!selected.length || saving !== null} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving === "bulk" ? "Setting…" : "Set selected"}</button>
      </div>
    </div>
    {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {message && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}
    <div className="mt-6 space-y-5">
      {grouped.map(({ rank, index, players: rankPlayers }) => {
        const ids = rankPlayers.map((player) => player.id);
        const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
        return <div key={rank.name} className="rounded-2xl border border-border bg-background/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold" style={{ color: rank.color }}>{rank.name}</p>
              <p className="text-xs text-muted">{rankPlayers.length} player{rankPlayers.length === 1 ? "" : "s"} · starts at {rank.minRhp.toLocaleString()} RHP</p>
            </div>
            {rankPlayers.length > 0 && <button onClick={() => toggleGroup(ids)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white">{allSelected ? "Deselect rank" : "Select rank"}</button>}
          </div>
          {rankPlayers.length === 0 ? <p className="mt-4 text-sm text-muted">No players at this rank.</p> : <div className="mt-4 space-y-2">
            {rankPlayers.map((player) => <div key={player.id} className="rounded-xl border border-border bg-surface/70 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <label className="flex min-w-0 items-center gap-3">
                  <input type="checkbox" checked={selected.includes(player.id)} onChange={() => toggleSelected(player.id)} className="h-4 w-4 accent-accent" />
                  <span className="min-w-0"><span className="block truncate font-semibold text-white">{player.displayName ?? player.username}</span><span className="block truncate text-xs text-muted">@{player.profileHandle} · {player.rhp.toLocaleString()} RHP</span></span>
                </label>
                <div className="grid shrink-0 gap-2 sm:grid-cols-[170px_110px_auto_auto_auto]">
                  <select value={rowRanks[player.id] ?? String(index)} onChange={(event) => setRowRanks((current) => ({ ...current, [player.id]: event.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-white">
                    {RANKS.map((destination, destinationIndex) => <option key={destination.name} value={destinationIndex}>{destination.name} · {destination.minRhp}</option>)}
                  </select>
                  <input type="number" min={0} max={1000000} step={1} value={rowRhp[player.id] ?? String(player.rhp)} onChange={(event) => setRowRhp((current) => ({ ...current, [player.id]: event.target.value }))} aria-label={`Exact RHP for ${player.displayName ?? player.username}`} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" />
                  <button onClick={() => void updatePlayers([player.id], { action: "set-rank", rankIndex: Number(rowRanks[player.id] ?? index) }, `rank:${player.id}`)} disabled={saving !== null} className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50">{saving === `rank:${player.id}` ? "Setting…" : "Set rank"}</button>
                  <button onClick={() => void updatePlayers([player.id], { action: "set-rhp", rhp: Number(rowRhp[player.id] ?? player.rhp) }, `rhp:${player.id}`)} disabled={saving !== null} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving === `rhp:${player.id}` ? "Setting…" : "Set RHP"}</button>
                  <button onClick={() => void updatePlayers([player.id], { action: "use-rp" }, `rp:${player.id}`)} disabled={saving !== null} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">{saving === `rp:${player.id}` ? "Reading…" : "Use RP"}</button>
                </div>
              </div>
            </div>)}
          </div>}
        </div>;
      })}
    </div>
  </section>;
}
