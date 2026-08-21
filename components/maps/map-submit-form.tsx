"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MapSubmitForm() {
  const router = useRouter();
  const [rhythiaUrl, setRhythiaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submittedMapId, setSubmittedMapId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmittedMapId(null);
    if (!rhythiaUrl.trim()) return setError("A Rhythia map URL is required.");
    setLoading(true);
    try {
      const response = await fetch("/api/maps/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionType: "ranked", rhythiaUrl: rhythiaUrl.trim() }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Map submission failed.");
      setSubmittedMapId(data.mapId ?? null);
      setSuccess(`Map submitted with Rhythians ID ${data.mapId}. The map data and rating were imported from Rhythia.`);
      setRhythiaUrl("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5">
        <p className="font-semibold text-white">Rhythia map URL</p>
        <p className="mt-1 text-sm leading-6 text-muted">Submit the original Rhythia map URL. Rhythians will fetch the map information, download, mapper, cover, and rating automatically.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="rhythia-map-url" className="block text-sm font-medium text-white">Rhythia map URL</label>
        <input id="rhythia-map-url" value={rhythiaUrl} onChange={(event) => setRhythiaUrl(event.target.value)} placeholder="https://www.rhythia.com/maps/12345" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" />
      </div>
      {error && <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}
      {submittedMapId && <p className="text-sm text-muted">Rhythians ID: <span className="font-mono text-white">{submittedMapId}</span></p>}
      <div className="flex justify-end"><button type="submit" disabled={loading} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Checking map…" : "Submit ranked map"}</button></div>
    </form>
  );
}
