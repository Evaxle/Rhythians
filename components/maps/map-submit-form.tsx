"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const validMapExtensions = ["sspm", "rhm", "osu", "zip"];
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

    const uploadResponse = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadResponse.ok) throw new Error("File upload failed.");
    return data.path;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) return setError("Title is required.");
    const rating = Number(requestedRating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 9.99) {
      return setError("Requested rating must be a number between 0 and 9.99 (two decimals).");
    }
    if (mode === "file" && !mapFile) {
      return setError("Please choose a map file to upload, or switch to URL mode and paste a Rhythia map link.");
    }
    if (mode === "file") {
      const extension = mapFile!.name.split(".").pop()?.toLowerCase() ?? "";
      if (!validMapExtensions.includes(extension)) {
        return setError("Map file must be .sspm, .rhm, .osu, or .zip.");
      }
    }
    if (mode === "url" && !rhythiaUrl.trim()) {
      return setError("Paste a Rhythia map URL like https://www.rhythia.com/maps/9257.");
    }
    if (imageFile && !validImageTypes.includes(imageFile.type)) {
      return setError("Cover image must be PNG, JPG, JPEG, or WEBP.");
    }

    setLoading(true);
    try {
      let mapPath = "";
      if (mode === "file") {
        mapPath = await uploadFile(mapFile!, "maps");
      }
      let imagePath: string | null = null;
      if (imageFile) imagePath = await uploadFile(imageFile, "map-images");

      const submitResponse = await fetch("/api/maps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim() || null,
          description: description.trim() || null,
          mapFileUrl: mapPath || null,
          imageUrl: imagePath,
          requestedRating: rating,
          mapperName: mapperName.trim() || null,
          noteCount: noteCount ? Number(noteCount) : null,
          length: length ? Number(length) : null,
          rhythiaUrl: mode === "url" ? rhythiaUrl.trim() : null,
        }),
      });
      const submitData = await submitResponse.json();
      if (!submitResponse.ok) throw new Error(submitData.error || "Map submission failed.");

      setSuccess("Map submitted! It will be reviewed by the map review team before it appears in the ranked list.");
      setTitle("");
      setArtist("");
      setDescription("");
      setMapperName("");
      setRequestedRating("");
      setNoteCount("");
      setLength("");
      setRhythiaUrl("");
      setMapFile(null);
      setImageFile(null);
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
        <p className="text-sm uppercase tracking-[0.24em] text-accent">How ratings work</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          Ratings use two decimal places and set which rank can play a map. A typical 5-star Rhythia map is around a
          2.05 rating. You suggest a rating — the map review team confirms or adjusts it before the map goes live.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-white">Map source</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
              mode === "file" ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/80 text-muted hover:border-accent/50 hover:text-white"
            }`}
          >
            Upload a file
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
              mode === "url" ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/80 text-muted hover:border-accent/50 hover:text-white"
            }`}
          >
            Rhythia map URL
          </button>
        </div>
        {mode === "url" && (
          <p className="mt-2 text-xs text-muted">
            Paste a safe Rhythia link like <span className="font-semibold text-white">https://www.rhythia.com/maps/9257</span>.
            The title, artist, and details are pulled automatically.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-white">Title</label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120}
            className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
            placeholder="Song name — Artist" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-white">Artist</label>
          <input value={artist} onChange={(event) => setArtist(event.target.value)} maxLength={120}
            className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
            placeholder="Artist name (auto-filled from URL)" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-white">Description</label>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3}
          className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
          placeholder="Anything about the map — gimmicks, tech, key patterns..." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-white">Requested rating (0 – 9.99)</label>
          <input type="number" step="0.01" min="0" max="9.99" value={requestedRating}
            onChange={(event) => setRequestedRating(event.target.value)}
            className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
            placeholder="e.g. 2.05" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-white">Mapper name</label>
          <input value={mapperName} onChange={(event) => setMapperName(event.target.value)} maxLength={60}
            className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
            placeholder="Your name or alias (auto-filled from URL)" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-white">Note count (optional)</label>
          <input type="number" min="0" value={noteCount} onChange={(event) => setNoteCount(event.target.value)}
            className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
            placeholder="e.g. 1200" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-white">Length in ms (optional)</label>
          <input type="number" min="0" value={length} onChange={(event) => setLength(event.target.value)}
            className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
            placeholder="e.g. 120000" />
        </div>
      </div>

      {mode === "file" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-white">Map file (.sspm, .rhm, .osu, .zip)</span>
            <input type="file" accept=".sspm,.rhm,.osu,.zip"
              onChange={(event) => setMapFile(event.target.files?.[0] ?? null)}
              className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-white">Cover image (optional)</span>
            <input type="file" accept={validImageTypes.join(",")}
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none" />
          </label>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-white">Rhythia map URL</label>
            <input value={rhythiaUrl} onChange={(event) => setRhythiaUrl(event.target.value)}
              className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
              placeholder="https://www.rhythia.com/maps/9257" />
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-white">Cover image (optional)</span>
            <input type="file" accept={validImageTypes.join(",")}
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none" />
          </label>
        </div>
      )}

      {error ? <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      {success ? <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Your map will be submitted for review and ranked once approved.</p>
        <button type="submit" disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Submitting…" : "Submit map"}
        </button>
      </div>
    </form>
  );
}