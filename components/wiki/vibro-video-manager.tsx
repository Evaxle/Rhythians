"use client";

import { useState } from "react";

const kinds = [
  { id: "linear", label: "Linear" },
  { id: "spin", label: "Spin" },
  { id: "mouse_swiveling", label: "Mouse Swiveling" },
  { id: "cheesing", label: "Cheesing" },
] as const;

type Kind = (typeof kinds)[number]["id"];

export function VibroVideoManager({ initialVideos }: { initialVideos: Partial<Record<Kind, string>> }) {
  const [videos, setVideos] = useState(initialVideos);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState("");

  async function upload(kind: Kind, file: File) {
    setBusy(kind);
    setError("");
    try {
      const prepare = await fetch("/api/wiki/vibro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload", kind, fileName: file.name, fileSize: file.size, contentType: file.type }),
      });
      const data = await prepare.json();
      if (!prepare.ok) throw new Error(data.error ?? "Could not prepare the upload.");
      const uploaded = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "video/mp4" }, body: file });
      if (!uploaded.ok) throw new Error("The video upload failed.");
      const save = await fetch("/api/wiki/vibro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", kind, path: data.path, publicUrl: data.publicUrl }),
      });
      const saved = await save.json();
      if (!save.ok) throw new Error(saved.error ?? "Could not save the video.");
      setVideos(saved.videos ?? {});
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload the video.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: Kind) {
    setBusy(kind);
    setError("");
    try {
      const response = await fetch("/api/wiki/vibro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", kind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove the video.");
      setVideos(data.videos ?? {});
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove the video.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="rounded-3xl border border-accent/25 bg-surface/95 p-6 shadow-glow"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Owner editor</p><h2 className="mt-2 text-2xl font-black text-white">Vibro demonstration videos</h2><p className="mt-2 text-sm leading-6 text-muted">Upload or replace the demonstration video for each technique. Only the site owner can use this editor.</p></div><div className="mt-6 grid gap-4 md:grid-cols-2">{kinds.map((kind) => <div key={kind.id} className="rounded-2xl border border-border bg-background/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-white">{kind.label}</p><p className="text-xs text-muted">{videos[kind.id] ? "Video published" : "No video uploaded"}</p></div>{videos[kind.id] && <button type="button" onClick={() => void remove(kind.id)} disabled={busy === kind.id} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-50">Remove</button>}</div><input type="file" accept="video/*" disabled={busy === kind.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(kind.id, file); event.currentTarget.value = ""; }} className="mt-4 block w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-white" />{videos[kind.id] && <video controls preload="metadata" src={videos[kind.id]} className="mt-4 aspect-video w-full rounded-xl object-cover" />}</div>)}</div>{error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}</section>;
}
