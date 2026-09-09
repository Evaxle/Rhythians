"use client";

import { useState } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { uploadFileToSignedStorageUrl } from "@/lib/signed-storage-upload";

export function SettingsOwnerEditor({ id, onUpdated }: { id: string; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [settingsFile, setSettingsFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("");
    if (!settingsFile && !videoFile && !videoUrl.trim()) return setMessage("Choose a replacement RHS file, gameplay video, or external video URL.");
    if (videoFile && videoUrl.trim()) return setMessage("Choose either a new video file or an external video URL, not both.");
    setBusy(true);
    try {
      let settingsPath = "";
      let videoPath = "";
      if (settingsFile || videoFile) {
        const response = await fetch("/api/settings/mine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upload", id, settingsFileName: settingsFile?.name, settingsFileSize: settingsFile?.size, videoFileName: videoFile?.name, videoFileSize: videoFile?.size }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not prepare the upload.");
        if (settingsFile && data.settingsUploadUrl) {
          await uploadFileToSignedStorageUrl(data.settingsUploadUrl, settingsFile);
          settingsPath = data.settingsPath;
        }
        if (videoFile && data.videoUploadUrl) {
          await uploadFileToSignedStorageUrl(data.videoUploadUrl, videoFile);
          videoPath = data.videoPath;
        }
      }
      const response = await fetch("/api/settings/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, settingsPath, settingsFileName: settingsFile?.name, videoPath, externalVideoUrl: videoUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update your settings.");
      setSettingsFile(null);
      setVideoFile(null);
      setVideoUrl("");
      setMessage("Your community settings were updated.");
      onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your settings.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.06] p-4">
    <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 text-sm font-semibold text-accent"><Upload size={15} /> {open ? "Close my settings editor" : "Update my settings files"}</button>
    {open && <div className="mt-4 grid gap-4">
      <label className="grid gap-2 text-xs font-semibold text-white">Replace RHS file<input type="file" accept=".rhs,application/octet-stream" onChange={(event) => setSettingsFile(event.target.files?.[0] ?? null)} className="rounded-xl border border-border bg-background p-3 text-sm text-white" /></label>
      <label className="grid gap-2 text-xs font-semibold text-white">Replace gameplay video file<input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)} className="rounded-xl border border-border bg-background p-3 text-sm text-white" /></label>
      <label className="grid gap-2 text-xs font-semibold text-white">Or use TikTok, YouTube, Twitch, or Medal.tv<input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="Paste external gameplay video URL" className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-white outline-none focus:border-accent" /></label>
      <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {busy ? "Updating…" : "Save replacements"}</button>{message && <span className="text-xs text-muted">{message}</span>}</div>
    </div>}
  </div>;
}
