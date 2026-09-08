"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CAMERA_MODES } from "@/lib/camera-mode";
import type { ClipSourceType } from "@/lib/clip-source";

const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
const validThumbnailTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const tabs: Array<{ value: ClipSourceType; label: string; hint: string }> = [
  { value: "upload", label: "File Upload", hint: "Upload MP4, WebM, or MOV" },
  { value: "tiktok", label: "TikTok Video", hint: "Paste a TikTok URL or choose a linked post" },
  { value: "youtube", label: "YouTube Video", hint: "Paste a YouTube video or Shorts URL" },
  { value: "twitch", label: "Twitch Clip", hint: "Paste a Twitch clip URL or choose from linked Twitch" },
];

type LibraryItem = { id: string; title: string; description?: string; url: string; thumbnailUrl?: string | null; duration?: number | null; createdAt?: string | null; viewCount?: number | null };

export default function ClipSubmitForm() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<ClipSourceType>("upload");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceThumbnailUrl, setSourceThumbnailUrl] = useState("");
  const [title, setTitle] = useState("");
  const [songName, setSongName] = useState("");
  const [description, setDescription] = useState("");
  const [cameraMode, setCameraMode] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryLinked, setLibraryLinked] = useState<boolean | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSourceUrl("");
    setSourceThumbnailUrl("");
    setLibraryItems([]);
    setLibraryLinked(null);
    setLibraryError("");
    if (sourceType !== "tiktok" && sourceType !== "twitch") return;
    let cancelled = false;
    setLibraryLoading(true);
    fetch(`/api/clips/source-library?platform=${sourceType}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Could not load ${sourceType} videos.`);
        if (cancelled) return;
        setLibraryLinked(Boolean(data.linked));
        setLibraryItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(err => { if (!cancelled) setLibraryError(err instanceof Error ? err.message : "Could not load linked videos."); })
      .finally(() => { if (!cancelled) setLibraryLoading(false); });
    return () => { cancelled = true; };
  }, [sourceType]);

  const uploadFile = async (file: File, folder: string) => {
    const response = await fetch("/api/clip-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type, folder, fileSize: file.size }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload URL generation failed.");
    const uploadResponse = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!uploadResponse.ok) throw new Error("File upload failed.");
    return data.path as string;
  };

  const generateThumbnail = async (file: File): Promise<File> => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("Could not read the video.")); });
    const duration = Number.isFinite(video.duration) && video.duration > 0.2 ? video.duration : 10;
    video.currentTime = Math.min(Math.max(duration * 0.25, 0), duration - 0.1);
    await new Promise<void>(resolve => { video.onseeked = () => resolve(); });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("Could not generate a thumbnail.");
    return new File([blob], "auto-thumbnail.jpg", { type: "image/jpeg" });
  };

  function chooseLibraryItem(item: LibraryItem) {
    setSourceUrl(item.url);
    setSourceThumbnailUrl(item.thumbnailUrl || "");
    if (!title.trim()) setTitle(item.title.slice(0, 120));
    if (!description.trim() && item.description) setDescription(item.description);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim()) return setError("Title is required.");
    if (title.length > 120) return setError("Title must be 120 characters or less.");
    if (sourceType === "upload") {
      if (!videoFile) return setError("Please choose a video file to upload.");
      if (!validVideoTypes.includes(videoFile.type)) return setError("Video must be MP4, WebM, or MOV.");
      if (thumbnailFile && !validThumbnailTypes.includes(thumbnailFile.type)) return setError("Thumbnail must be PNG, JPG, JPEG, or WEBP.");
    } else if (!sourceUrl.trim()) return setError(`Paste or choose a ${sourceType === "tiktok" ? "TikTok video" : sourceType === "youtube" ? "YouTube video" : "Twitch clip"}.`);

    setLoading(true);
    try {
      let storagePath: string | undefined;
      let thumbnailPath: string | undefined;
      if (sourceType === "upload" && videoFile) {
        storagePath = await uploadFile(videoFile, "clips");
        if (thumbnailFile) thumbnailPath = await uploadFile(thumbnailFile, "thumbnails");
        else {
          try { thumbnailPath = await uploadFile(await generateThumbnail(videoFile), "thumbnails"); } catch {}
        }
      }

      const response = await fetch("/api/clips/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), songName: songName.trim() || null, description: description.trim(), cameraMode: cameraMode || null, sourceType, sourceUrl: sourceUrl.trim() || undefined, sourceThumbnailUrl: sourceThumbnailUrl || undefined, storagePath, thumbnailPath }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clip submission failed.");
      setSuccess("Clip submitted! It will appear once approved.");
      setTitle(""); setSongName(""); setDescription(""); setCameraMode(""); setVideoFile(null); setThumbnailFile(null); setSourceUrl(""); setSourceThumbnailUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-surface/95 p-5 shadow-glow sm:p-8">
      <div>
        <p className="text-sm font-semibold text-white">Clip source</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {tabs.map(tab => <button key={tab.value} type="button" onClick={() => setSourceType(tab.value)} className={`rounded-2xl border p-3 text-left transition ${sourceType === tab.value ? "border-accent bg-accent/15" : "border-border bg-background/70 hover:border-accent/40"}`}><span className={`block text-sm font-semibold ${sourceType === tab.value ? "text-accent" : "text-white"}`}>{tab.label}</span><span className="mt-1 block text-xs leading-5 text-muted">{tab.hint}</span></button>)}
        </div>
      </div>

      {sourceType === "upload" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-white">Video file</span><input type="file" accept={validVideoTypes.join(",")} onChange={event => setVideoFile(event.target.files?.[0] ?? null)} className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" /></label>
          <label className="block"><span className="text-sm font-semibold text-white">Thumbnail (optional)</span><input type="file" accept={validThumbnailTypes.join(",")} onChange={event => setThumbnailFile(event.target.files?.[0] ?? null)} className="mt-3 w-full cursor-pointer rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white" /></label>
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border border-border bg-background/45 p-4 sm:p-5">
          <label className="block"><span className="text-sm font-semibold text-white">{sourceType === "tiktok" ? "TikTok video URL" : sourceType === "youtube" ? "YouTube video URL" : "Twitch clip URL"}</span><input value={sourceUrl} onChange={event => { setSourceUrl(event.target.value); setSourceThumbnailUrl(""); }} placeholder={sourceType === "tiktok" ? "https://www.tiktok.com/@user/video/..." : sourceType === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://clips.twitch.tv/..."} className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none focus:border-accent" /></label>
          {(sourceType === "tiktok" || sourceType === "twitch") && <div><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-white">Choose from linked {sourceType === "tiktok" ? "TikTok" : "Twitch"}</p>{libraryLoading && <span className="text-xs text-muted">Loading…</span>}</div>{libraryError && <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">{libraryError}</p>}{libraryLinked === false && <p className="rounded-2xl border border-border bg-white/[0.03] p-4 text-sm text-muted">No linked {sourceType === "tiktok" ? "TikTok" : "Twitch"} account. Link it from your profile/settings, or paste a public URL above.</p>}{libraryLinked && !libraryLoading && libraryItems.length === 0 && <p className="text-sm text-muted">No public videos/clips were returned for this linked account.</p>}<div className="grid max-h-[420px] gap-3 overflow-y-auto sm:grid-cols-2">{libraryItems.map(item => <button key={item.id} type="button" onClick={() => chooseLibraryItem(item)} className={`overflow-hidden rounded-2xl border text-left transition hover:border-accent/50 ${sourceUrl === item.url ? "border-accent bg-accent/10" : "border-border bg-surface"}`}>{item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />}<div className="p-3"><p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p><p className="mt-1 text-xs text-muted">{item.duration ? `${Math.round(item.duration)}s` : "Video"}{typeof item.viewCount === "number" ? ` · ${item.viewCount.toLocaleString()} views` : ""}</p></div></button>)}</div></div>}
        </div>
      )}

      <div><label className="block text-sm font-semibold text-white">Title</label><input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="Enter a catchy title" /></div>
      <div><label className="block text-sm font-semibold text-white">Song / map name</label><input value={songName} onChange={event => setSongName(event.target.value)} maxLength={120} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="e.g. Camellia - We Magicians Still Alive In 2021" /></div>
      <div><label className="block text-sm font-semibold text-white">Description</label><textarea value={description} onChange={event => setDescription(event.target.value)} rows={5} className="mt-3 w-full rounded-3xl border border-border bg-background/80 px-4 py-3 text-sm text-white outline-none focus:border-accent" placeholder="Share what makes this clip special..." /></div>
      <div><p className="text-sm font-semibold text-white">Camera mode</p><div className="mt-4 flex flex-wrap gap-2">{CAMERA_MODES.map(mode => <button key={mode.value} type="button" onClick={() => setCameraMode(mode.value)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${cameraMode === mode.value ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/80 text-muted hover:border-accent/50 hover:text-white"}`}>{mode.emoji} {mode.label}</button>)}</div></div>
      {error && <div className="rounded-3xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {success && <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted">Your clip will be submitted for review and published on approval.</p><button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-60">{loading ? "Submitting…" : "Submit clip"}</button></div>
    </form>
  );
}
