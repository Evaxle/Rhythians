"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const validMapExtensions = ["sspm", "rhm", "osu", "zip"];
const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

type SourceMode = "file" | "url";

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

export default function ChallengeMapSubmitForm() {
  const router = useRouter();
  const [mode, setMode] = useState<SourceMode>("file");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [mapperName, setMapperName] = useState("");
  const [noteCount, setNoteCount] = useState("");
  const [length, setLength] = useState("");
  const [rhythiaUrl, setRhythiaUrl] = useState("");
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim()) return setError("Title is required.");
    if (mode === "file" && !mapFile) return setError("Please choose a map file or switch to Rhythia URL mode.");
    if (mode === "file") {
      const extension = mapFile!.name.split(".").pop()?.toLowerCase() ?? "";
      if (!validMapExtensions.includes(extension)) return setError("Map file must be .sspm, .rhm, .osu, or .zip.");
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
          submissionType: "challenge",
          title: title.trim(),
          artist: artist.trim() || null,
          description: description.trim() || null,
          mapFileUrl: mapPath || null,
          imageUrl: imagePath,
          requestedRating: 0,
          mapperName: mapperName.trim() || null,
          noteCount: noteCount ? Number(noteCount) : null,
          length: length ? Number(length) : null,
          rhythiaUrl: mode === "url" ? rhythiaUrl.trim() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Challenge map submission failed.");
      setSuccess("Challenge map submitted. A reviewer will place it in the main challenge or a skill category and assign its level.");
      setTitle(""); setArtist(""); setDescription(""); setMapperName(""); setNoteCount(""); setLength(""); setRhythiaUrl(""); setMapFile(null); setImageFile(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm leading-6 text-muted">
        Challenge maps do not award RHP. A pass counts only toward the challenge level where the reviewer places the map.
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Map source</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["file", "url"] as const).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${mode === value ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/80 text-muted hover:text-white"}`}>{value === "file" ? "Upload a file" : "Rhythia map URL"}</button>)}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div><label className="block text-sm font-semibold text-white">Title</label><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="Song name — Artist" /></div>
        <div><label className="block text-sm font-semibold text-white">Artist</label><input value={artist} onChange={(event) => setArtist(event.target.value)} maxLength={120} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="Artist name" /></div>
      </div>
      <div><label className="block text-sm font-semibold text-white">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="Patterns, gimmicks, skill focus, or other context..." /></div>
      <div><label className="block text-sm font-semibold text-white">Mapper name</label><input value={mapperName} onChange={(event) => setMapperName(event.target.value)} maxLength={60} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="Mapper name or alias" /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div><label className="block text-sm font-semibold text-white">Note count (optional)</label><input type="number" min="0" value={noteCount} onChange={(event) => setNoteCount(event.target.value)} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" /></div>
        <div><label className="block text-sm font-semibold text-white">Length in ms (optional)</label><input type="number" min="0" value={length} onChange={(event) => setLength(event.target.value)} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" /></div>
      </div>
      {mode === "file" ? <div className="grid gap-6 lg:grid-cols-2"><label className="block"><span className="text-sm font-semibold text-white">Map file</span><input type="file" accept=".sspm,.rhm,.osu,.zip" onChange={(event) => setMapFile(event.target.files?.[0] ?? null)} className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" /></label><label className="block"><span className="text-sm font-semibold text-white">Cover image</span><input type="file" accept={validImageTypes.join(",")} onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" /></label></div> : <div className="grid gap-6 lg:grid-cols-2"><div><label className="block text-sm font-semibold text-white">Rhythia map URL</label><input value={rhythiaUrl} onChange={(event) => setRhythiaUrl(event.target.value)} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="https://www.rhythia.com/maps/9257" /></div><label className="block"><span className="text-sm font-semibold text-white">Cover image</span><input type="file" accept={validImageTypes.join(",")} onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" /></label></div>}
      {error && <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted">Reviewers decide the main challenge or skill category and level.</p><button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-60">{loading ? "Submitting…" : "Submit challenge map"}</button></div>
    </form>
  );
}
