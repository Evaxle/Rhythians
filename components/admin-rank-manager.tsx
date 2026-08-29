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
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  async function setRank(userIds: string[], rankIndex: string) {
    if (userIds.length === 0) return;
    setSaving(userIds.length === 1 ? userIds[0] : "bulk");
    setError("");
    try {
      const response = await fetch("/api/admin/users/rank", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds, rankIndex: Number(rankIndex) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update ranks.");
      setSelected((current) => current.filter((id) => !userIds.includes(id)));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update ranks.");
    } finally {
      setSaving(null);
    }
  }

  return <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Rank management</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Players by rank</h2>
        <p className="mt-2 text-sm leading-7 text-muted">Select one or more players, choose a destination rank, and apply it immediately. Their RHP and displayed rank will update together.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-sm text-muted">{selected.length} selected</span>
        <select value={bulkRank} onChange={(event) => setBulkRank(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-white">
          {RANKS.map((rank, index) => <option key={rank.name} value={index}>{rank.name}</option>)}
        </select>
        <button onClick={() => void setRank(selected, bulkRank)} disabled={!selected.length || saving !== null} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving === "bulk" ? "Setting…" : "Set selected"}</button>
      </div>
    </div>
    {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <div className="mt-6 space-y-5">
      {grouped.map(({ rank, index, players: rankPlayers }) => {
        const ids = rankPlayers.map((player) => player.id);
        const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
        return <div key={rank.name} className="rounded-2xl border border-border bg-background/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold" style={{ color: rank.color }}>{rank.name}</p>
              <p className="text-xs text-muted">{rankPlayers.length} player{rankPlayers.length === 1 ? "" : "s"}</p>
            </div>
            {rankPlayers.length > 0 && <button onClick={() => toggleGroup(ids)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white">{allSelected ? "Deselect rank" : "Select rank"}</button>}
          </div>
          {rankPlayers.length === 0 ? <p className="mt-4 text-sm text-muted">No players at this rank.</p> : <div className="mt-4 space-y-2">
            {rankPlayers.map((player) => <div key={player.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface/70 p-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex min-w-0 items-center gap-3">
                <input type="checkbox" checked={selected.includes(player.id)} onChange={() => toggleSelected(player.id)} className="h-4 w-4 accent-accent" />
                <span className="min-w-0"><span className="block truncate font-semibold text-white">{player.displayName ?? player.username}</span><span className="block truncate text-xs text-muted">@{player.profileHandle} · {player.rhp.toLocaleString()} RHP</span></span>
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <select value={rowRanks[player.id] ?? String(index)} onChange={(event) => setRowRanks((current) => ({ ...current, [player.id]: event.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-white">
                  {RANKS.map((destination, destinationIndex) => <option key={destination.name} value={destinationIndex}>{destination.name}</option>)}
                </select>
                <button onClick={() => void setRank([player.id], rowRanks[player.id] ?? String(index))} disabled={saving !== null} className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50">{saving === player.id ? "Setting…" : "Set rank"}</button>
              </div>
            </div>)}
          </div>}
        </div>;
      })}
    </div>
  </section>;
}
