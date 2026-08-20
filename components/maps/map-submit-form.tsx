"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const validMapExtensions = ["sspm", "rhm"];

type Mode = "file" | "url";

export default function MapSubmitForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [requestedRating, setRequestedRating] = useState("");
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [rhythiaUrl, setRhythiaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function uploadFile(file: File) {
    const contentType = file.type || "application/octet-stream";
    const response = await fetch("/api/maps/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType, folder: "maps", fileSize: file.size }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.uploadUrl) throw new Error(data?.error || "Upload URL generation failed.");
    const uploadResponse = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!uploadResponse.ok) throw new Error("File upload failed.");
    return data.path as string;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (mode === "url") {
      if (!rhythiaUrl.trim()) return setError("A Rhythia map URL is required.");
    } else {
      if (!title.trim()) return setError("Title is required.");
      if (!artist.trim()) return setError("Artist is required.");
      if (!description.trim()) return setError("Description is required.");
      const rating = Number(requestedRating);
      if (!requestedRating.trim() || !Number.isFinite(rating) || rating <= 0 || rating > 9.99) return setError("Requested rating must be between 0.1 and 9.99.");
      if (!mapFile) return setError("Choose a .rhm or .sspm file.");
      const extension = mapFile.name.split(".").pop()?.toLowerCase() ?? "";
      if (!validMapExtensions.includes(extension)) return setError("Map file must be .rhm or .sspm.");
    }

    setLoading(true);
    try {
      const mapPath = mode === "file" && mapFile ? await uploadFile(mapFile) : undefined;
      const response = await fetch("/api/maps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: mode === "url"
          ? JSON.stringify({ submissionType: "ranked", rhythiaUrl: rhythiaUrl.trim() })
          : JSON.stringify({ submissionType: "ranked", title: title.trim(), artist: artist.trim(), description: description.trim(), requestedRating: Number(requestedRating), mapFileUrl: mapPath }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Map submission failed.");
      setSuccess(`Map submitted with Rhythians ID ${data.mapId}. It will be available after approval.`);
      setTitle(""); setArtist(""); setDescription(""); setRequestedRating(""); setMapFile(null); setRhythiaUrl("");
      const input = document.getElementById("ranked-map-file") as HTMLInputElement | null;
      if (input) input.value = "";
      router.refresh();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-background/60 p-1">
        <button type="button" onClick={() => setMode("file")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "file" ? "bg-accent text-white" : "text-muted"}`}>Upload map file</button>
        <button type="button" onClick={() => setMode("url")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "url" ? "bg-accent text-white" : "text-muted"}`}>Rhythia URL</button>
      </div>
      {mode === "url" ? (
        <div className="space-y-2">
          <label htmlFor="rhythia-map-url" className="block text-sm font-medium text-white">Rhythia map URL</label>
          <input id="rhythia-map-url" value={rhythiaUrl} onChange={e => setRhythiaUrl(e.target.value)} placeholder="https://rhythia.net/maps/..." className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
          <p className="text-xs text-muted">The map information, file, and rating are fetched automatically from Rhythia.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Map title" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
            <input value={artist} onChange={e => setArtist(e.target.value)} maxLength={120} placeholder="Artist" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder="Description" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
          <input type="number" min="0.1" max="9.99" step="0.01" value={requestedRating} onChange={e => setRequestedRating(e.target.value)} placeholder="Requested rating" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
          <div>
            <label htmlFor="ranked-map-file" className="mb-2 block text-sm font-medium text-white">Map file</label>
            <input id="ranked-map-file" type="file" accept=".rhm,.sspm" onChange={e => setMapFile(e.target.files?.[0] ?? null)} className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
            <p className="mt-2 text-xs text-muted">Upload an .SSPM or .RHM map file.</p>
          </div>
        </>
      )}
      {error && <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}
      <div className="flex justify-end"><button type="submit" disabled={loading} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Submitting…" : "Submit ranked map"}</button></div>
    </form>
  );
}
