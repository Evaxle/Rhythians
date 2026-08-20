"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const validMapExtensions = ["sspm", "rhm"];

export default function MapSubmitForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function uploadFile(file: File) {
    const response = await fetch("/api/maps/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: "maps", fileSize: file.size }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload URL generation failed.");
    const uploadResponse = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!uploadResponse.ok) throw new Error("File upload failed.");
    return data.path;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim()) return setError("Title is required.");
    if (!artist.trim()) return setError("Artist is required.");
    if (!description.trim()) return setError("Description is required.");
    if (!mapFile) return setError("Choose a .rhm or .sspm file.");
    const extension = mapFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!validMapExtensions.includes(extension)) return setError("Map file must be .rhm or .sspm.");

    setLoading(true);
    try {
      const mapPath = await uploadFile(mapFile);
      const response = await fetch("/api/maps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionType: "ranked", title: title.trim(), artist: artist.trim(), description: description.trim(), mapFileUrl: mapPath }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Map submission failed.");
      setSuccess(`Map submitted with Rhythians ID ${data.mapId}. It will be available as an SSPM download after approval.`);
      setTitle("");
      setArtist("");
      setDescription("");
      setMapFile(null);
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
      <div className="grid gap-6 lg:grid-cols-2">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Map title" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
        <input value={artist} onChange={e => setArtist(e.target.value)} maxLength={120} placeholder="Artist" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
      </div>
      <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder="Description" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
      <div>
        <label htmlFor="ranked-map-file" className="mb-2 block text-sm font-medium text-white">Map file</label>
        <input id="ranked-map-file" type="file" accept=".rhm,.sspm" onChange={e => setMapFile(e.target.files?.[0] ?? null)} className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
        <p className="mt-2 text-xs text-muted">Upload an .SSPM or .RHM map file.</p>
      </div>
      {error && <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Submitting…" : "Submit ranked map"}</button>
      </div>
    </form>
  );
}
