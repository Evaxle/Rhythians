"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const validMapExtensions = ["sspm", "rhm"];
const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

type SourceMode = "file" | "url";

export default function MapSubmitForm() {
  const router = useRouter();
  const [mode, setMode] = useState<SourceMode>("file");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [mapperName, setMapperName] = useState("");
  const [requestedRating, setRequestedRating] = useState("");
  const [noteCount, setNoteCount] = useState("");
  const [length, setLength] = useState("");
  const [rhythiaUrl, setRhythiaUrl] = useState("");
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function uploadFile(file: File, folder: string) {
    const response = await fetch("/api/maps/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, folder, fileSize: file.size }),
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
    const rating = Number(requestedRating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 9.99) return setError("Requested rating must be a number between 0 and 9.99.");
    if (mode === "file" && !mapFile) return setError("Choose a .rhm or .sspm file.");
    if (mode === "file") {
      const extension = mapFile!.name.split(".").pop()?.toLowerCase() ?? "";
      if (!validMapExtensions.includes(extension)) return setError("Map file must be .rhm or .sspm.");
    }
    if (mode === "url" && !rhythiaUrl.trim()) return setError("Paste a Rhythia map URL.");
    if (imageFile && !validImageTypes.includes(imageFile.type)) return setError("Cover image must be PNG, JPG, JPEG, or WEBP.");

    setLoading(true);
    try {
      const mapPath = mode === "file" ? await uploadFile(mapFile!, "maps") : "";
      const imagePath = imageFile ? await uploadFile(imageFile, "map-images") : null;
      const response = await fetch("/api/maps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), artist: artist.trim() || null, description: description.trim() || null,
          mapFileUrl: mapPath || null, imageUrl: imagePath, requestedRating: rating,
          mapperName: mapperName.trim() || null, noteCount: noteCount ? Number(noteCount) : null,
          length: length ? Number(length) : null, rhythiaUrl: mode === "url" ? rhythiaUrl.trim() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Map submission failed.");
      setSuccess(`Map submitted with Rhythians ID ${data.mapId}. The file will be linked to this ID when downloaded.`);
      setTitle(""); setArtist(""); setDescription(""); setMapperName(""); setRequestedRating("");
      setNoteCount(""); setLength(""); setRhythiaUrl(""); setMapFile(null); setImageFile(null);
      router.refresh();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-accent">Map source</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("file")} className={`rounded-full border px-5 py-2 text-sm font-semibold ${mode === "file" ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/80 text-muted"}`}>Upload .RHM / .SSPM</button>
          <button type="button" onClick={() => setMode("url")} className={`rounded-full border px-5 py-2 text-sm font-semibold ${mode === "url" ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/80 text-muted"}`}>Rhythia URL</button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Title" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
        <input value={artist} onChange={e => setArtist(e.target.value)} maxLength={120} placeholder="Artist" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
      </div>
      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Description" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
      <div className="grid gap-6 lg:grid-cols-2">
        <input type="number" step="0.01" min="0" max="9.99" value={requestedRating} onChange={e => setRequestedRating(e.target.value)} placeholder="Requested rating" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
        <input value={mapperName} onChange={e => setMapperName(e.target.value)} maxLength={60} placeholder="Mapper name" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <input type="number" min="0" value={noteCount} onChange={e => setNoteCount(e.target.value)} placeholder="Note count" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
        <input type="number" min="0" value={length} onChange={e => setLength(e.target.value)} placeholder="Length in ms" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
      </div>
      {mode === "file" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <input type="file" accept=".rhm,.sspm" onChange={e => setMapFile(e.target.files?.[0] ?? null)} className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
          <input type="file" accept={validImageTypes.join(",")} onChange={e => setImageFile(e.target.files?.[0] ?? null)} className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <input value={rhythiaUrl} onChange={e => setRhythiaUrl(e.target.value)} placeholder="https://www.rhythia.com/maps/9257" className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
          <input type="file" accept={validImageTypes.join(",")} onChange={e => setImageFile(e.target.files?.[0] ?? null)} className="w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" />
        </div>
      )}
      {error && <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Submitting…" : "Submit map"}</button>
      </div>
    </form>
  );
}
