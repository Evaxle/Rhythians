"use client";

import { useEffect, useState } from "react";
import { MessageSettings } from "@/components/admin/message-settings";

interface UserOption { userId: string; globalRank: number | null; user: { username: string; displayName: string | null } }
interface Entry { id: string; cameraMode: string; settingsFileName: string; username: string; displayName: string | null; globalRank: number | null; title: string | null }

const videoAccept = "video/*,.mp4,.webm,.mov,.m4v,.mkv,.avi,.wmv,.flv,.mpeg,.mpg,.3gp,.ogv,.ts,.mts,.m2ts";

export default function AdminSettingsPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("lock");
  const [userId, setUserId] = useState("");
  const [settingsFile, setSettingsFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    if (response.ok) setEntries((await response.json()).settings ?? []);
  }

  async function searchUsers(value: string) {
    setQuery(value);
    const response = await fetch(`/api/admin/settings/users?q=${encodeURIComponent(value)}`, { cache: "no-store" });
    if (response.ok) setUsers((await response.json()).users ?? []);
  }

  useEffect(() => { void load(); void searchUsers(""); }, []);

  async function publish() {
    setError("");
    if (!userId || !settingsFile || !videoFile) { setError("Choose a connected Rhythia user, settings file, and video."); return; }
    setBusy(true);
    try {
      const prepare = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload", settingsFileName: settingsFile.name, settingsFileSize: settingsFile.size, settingsContentType: settingsFile.type, videoFileName: videoFile.name, videoFileSize: videoFile.size, videoContentType: videoFile.type }) });
      const uploadData = await prepare.json();
      if (!prepare.ok) throw new Error(uploadData.error ?? "Could not prepare uploads.");
      const [settingsUpload, videoUpload] = await Promise.all([fetch(uploadData.settingsUploadUrl, { method: "PUT", headers: { "Content-Type": settingsFile.type || "application/octet-stream" }, body: settingsFile }), fetch(uploadData.videoUploadUrl, { method: "PUT", headers: { "Content-Type": videoFile.type || "application/octet-stream" }, body: videoFile })]);
      if (!settingsUpload.ok || !videoUpload.ok) {
        const failed = !settingsUpload.ok && !videoUpload.ok ? "settings file and video" : !settingsUpload.ok ? "settings file" : "video";
        throw new Error(`The ${failed} failed to upload.`);
      }
      const create = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", cameraMode: mode, userId, settingsPath: uploadData.settingsPath, videoPath: uploadData.videoPath, settingsFileName: settingsFile.name, title, description }) });
      const createData = await create.json();
      if (!create.ok) throw new Error(createData.error ?? "Could not publish settings.");
      setSettingsFile(null); setVideoFile(null); setTitle(""); setDescription(""); setUserId(""); await load();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not publish settings."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this settings entry?")) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    await load();
  }

  return <div className="space-y-6"><div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow"><h1 className="text-3xl font-semibold text-white">System settings</h1><p className="mt-3 text-sm leading-7 text-muted">Configure branding, open graph metadata, feature flags, Discord integration, and player settings showcases.</p></div><section className="rounded-3xl border border-border bg-surface/95 p-7 shadow-glow"><p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Player settings showcase</p><h2 className="mt-2 text-2xl font-black text-white">Publish Lock or Spin settings</h2><div className="mt-6 grid gap-5 lg:grid-cols-2"><div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Camera mode</label><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setMode("lock")} className={`rounded-xl px-4 py-3 font-bold ${mode === "lock" ? "bg-accent text-white" : "border border-border text-muted"}`}>Lock</button><button onClick={() => setMode("spin")} className={`rounded-xl px-4 py-3 font-bold ${mode === "spin" ? "bg-accent text-white" : "border border-border text-muted"}`}>Spin</button></div></div><div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Connected Rhythia user</label><input value={query} onChange={(e) => void searchUsers(e.target.value)} placeholder="Search username..." className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white outline-none focus:border-accent" /><select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white"><option value="">Choose user</option>{users.map((user) => <option key={user.userId} value={user.userId}>{user.user.displayName || user.user.username} · {user.globalRank ? `#${user.globalRank}` : "Unranked"}</option>)}</select></div><div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Settings file</label><p className="mt-1 text-xs text-muted">Accepts .rhm and .json files.</p><input type="file" accept=".rhm,.json,application/json,application/octet-stream" onChange={(e) => setSettingsFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div><div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Gameplay video</label><p className="mt-1 text-xs text-muted">Accepts standard video formats including MP4, WebM, MOV, MKV, AVI, and more.</p><input type="file" accept={videoAccept} onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div><div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div><div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional player/settings information" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div></div>{error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<button disabled={busy} onClick={() => void publish()} className="mt-5 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Uploading..." : "Publish settings"}</button></section><section className="space-y-3">{entries.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface/90 p-4"><div><p className="font-bold text-white">{entry.displayName || entry.username} · {entry.cameraMode}</p><p className="text-sm text-muted">{entry.globalRank ? `Global #${entry.globalRank}` : "Unranked"} · {entry.settingsFileName}</p></div><button onClick={() => void remove(entry.id)} className="rounded-xl border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-200">Delete</button></div>)}</section><MessageSettings /></div>;
}