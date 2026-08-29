"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type RhythianPathMapOption = {
  id: string;
  title: string;
  artist: string | null;
  rating: number | null;
  mapperName: string | null;
};

export function RhythianPathMapSelector({ rankIndex, rankName, currentMap }: { rankIndex: number; rankName: string; currentMap: RhythianPathMapOption | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [maps, setMaps] = useState<RhythianPathMapOption[]>(currentMap ? [currentMap] : []);
  const [selectedMapId, setSelectedMapId] = useState(currentMap?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/rhythian-path/maps?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (response.ok) {
          const nextMaps = data.maps as RhythianPathMapOption[];
          setMaps(currentMap && !nextMaps.some((map) => map.id === currentMap.id) ? [currentMap, ...nextMaps] : nextMaps);
        }
      } finally {
        setLoading(false);
      }
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query, currentMap]);

  async function saveMap() {
    if (!selectedMapId) return;
    if (!window.confirm(`Assign this map to the ${rankName} path rank? Progress from this rank onward will be reset for the current season.`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/rhythian-path/set-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankIndex, challengeMapId: selectedMapId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not assign the path map.");
      setQuery("");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not assign the path map.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Manual map selection</p>
      <p className="mt-1 text-xs text-muted">Optional override for this rank. Leaving the existing map unchanged keeps automatic assignment.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search approved maps..." className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-muted focus:border-accent/50" />
          <select value={selectedMapId} onChange={(event) => setSelectedMapId(event.target.value)} disabled={loading || busy} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-accent/50">
            <option value="">Select an approved map</option>
            {maps.map((map) => <option key={map.id} value={map.id}>{map.title}{map.artist ? ` — ${map.artist}` : ""}{map.rating != null ? ` [${map.rating.toFixed(2)}]` : ""}{map.mapperName ? ` — ${map.mapperName}` : ""}</option>)}
          </select>
        </div>
        <button type="button" onClick={saveMap} disabled={!selectedMapId || busy} className="self-end rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving..." : "Assign map"}</button>
      </div>
    </div>
  );
}
