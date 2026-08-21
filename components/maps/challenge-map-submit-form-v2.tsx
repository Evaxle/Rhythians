"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const validMapExtensions = ["sspm", "rhm", "osu", "zip"];
type SourceMode = "file" | "rhythia" | "rhythians";
const categories = [["main_challenge", "Main Challenge"], ["jumps", "Jumps"], ["stream", "Stream"], ["tech", "Tech"], ["off_grid", "Off Grid"], ["vibro", "Vibro"]] as const;

async function uploadFile(file: File) {
  const response = await fetch("/api/maps/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream", folder: "maps", fileSize: file.size }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Upload URL generation failed.");
  const uploadResponse = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!uploadResponse.ok) throw new Error("File upload failed.");
  return data.path as string;
}

export default function ChallengeMapSubmitForm() {
  const router = useRouter();
  const [mode, setMode] = useState<SourceMode>("rhythia");
  const [category, setCategory] = useState("main_challenge");
  const [level, setLevel] = useState("1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rhythiaUrl, setRhythiaUrl] = useState("");
  const [rhythiansUrl, setRhythiansUrl] = useState("");
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (mode === "file" && !mapFile) return setError("Choose a map file.");
    if (mode === "file") {
      const extension = mapFile!.name.split(".").pop()?.toLowerCase() ?? "";
      if (!validMapExtensions.includes(extension)) return setError("Map file must be .sspm, .rhm, .osu, or .zip.");
    }
    if (mode === "rhythia" && !rhythiaUrl.trim()) return setError("Paste a Rhythia map URL.");
    if (mode === "rhythians" && !rhythiansUrl.trim()) return setError("Paste a Rhythians map URL.");
    const requestedLevel = Number(level);
    if (!Number.isInteger(requestedLevel) || requestedLevel < 1 || requestedLevel > 10) return setError("Requested level must be between 1 and 10.");
    if (mode === "file" && !title.trim()) return setError("Title is required for file submissions.");

    setLoading(true);
    try {
      const mapPath = mode === "file" ? await uploadFile(mapFile!) : null;
      const response = await fetch("/api/maps/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionType: "challenge", challengeCategory: category, requestedLevel, title: title.trim() || null, description: description.trim() || null, mapFileUrl: mapPath, rhythiaUrl: mode === "rhythia" ? rhythiaUrl.trim() : null, rhythiansUrl: mode === "rhythians" ? rhythiansUrl.trim() : null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Challenge map submission failed.");
      setSuccess(`Challenge map submitted for ${categories.find(([value]) => value === category)?.[1] ?? category}, level ${requestedLevel}.`);
      setTitle(""); setDescription(""); setRhythiaUrl(""); setRhythiansUrl(""); setMapFile(null);
      const input = document.getElementById("challenge-map-file") as HTMLInputElement | null;
      if (input) input.value = "";
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
      <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm leading-6 text-muted">Challenge maps do not award RHP. Reviewers use your requested category and level when deciding where the map belongs.</div>
      <div><label className="block text-sm font-semibold text-white">Requested category</label><select value={category} onChange={event => setCategory(event.target.value)} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="block text-sm font-semibold text-white">Requested level</label><input type="number" min="1" max="10" value={level} onChange={event => setLevel(event.target.value)} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" /></div>
      <div><p className="text-sm font-semibold text-white">Map source</p><div className="mt-3 flex flex-wrap gap-2">{(["rhythia", "rhythians", "file"] as const).map(value => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${mode === value ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/80 text-muted hover:text-white"}`}>{value === "rhythia" ? "Rhythia URL" : value === "rhythians" ? "Rhythians URL" : "Upload file"}</button>)}</div></div>
      {mode === "rhythia" && <div><label className="block text-sm font-semibold text-white">Rhythia map URL</label><input value={rhythiaUrl} onChange={event => setRhythiaUrl(event.target.value)} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" placeholder="https://www.rhythia.com/maps/9257" /></div>}
      {mode === "rhythians" && <div><label className="block text-sm font-semibold text-white">Rhythians map URL</label><input value={rhythiansUrl} onChange={event => setRhythiansUrl(event.target.value)} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" placeholder="https://rhythians.vercel.app/maps/..." /></div>}
      {mode === "file" && <><div><label className="block text-sm font-semibold text-white">Map file</label><input id="challenge-map-file" type="file" accept=".sspm,.rhm,.osu,.zip" onChange={event => setMapFile(event.target.files?.[0] ?? null)} className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" /></div><div><label className="block text-sm font-semibold text-white">Title</label><input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" placeholder="Song name — Artist" /></div></>}
      <div><label className="block text-sm font-semibold text-white">Description</label><textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" placeholder="Patterns, gimmicks, skill focus, or other context..." /></div>
      {error && <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}
      <div className="flex justify-end"><button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Checking map…" : "Submit challenge map"}</button></div>
    </form>
  );
}
