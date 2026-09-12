"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { MessageSettings } from "@/components/admin/message-settings";
import { uploadFileToSignedStorageUrl } from "@/lib/signed-storage-upload";

interface UserOption { userId: string; profileId: number; username: string | null; globalRank: number | null; profileUrl: string; avatarUrl: string | null; user: { username: string; displayName: string | null; profileHandle: string } }
interface Entry { id: string; cameraMode: string; userId: string; settingsFileName: string; username: string; displayName: string | null; profileUsername: string | null; globalRank: number | null; title: string | null; description: string | null }
const videoAccept = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v";

export default function AdminSettingsPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("lock");
  const [userId, setUserId] = useState("");
  const [settingsFile, setSettingsFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() { const response = await fetch("/api/admin/settings", { cache: "no-store" }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "Could not load community settings."); setEntries(Array.isArray(data?.settings) ? data.settings : []); }
  async function searchUsers(value: string) { setQuery(value); setProfilesLoading(true); try { const response = await fetch(`/api/admin/settings/users?q=${encodeURIComponent(value)}`, { cache: "no-store" }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "Could not load connected Rhythia profiles."); setUsers(Array.isArray(data?.users) ? data.users : []); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load connected Rhythia profiles."); } finally { setProfilesLoading(false); } }
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load community settings.")); void searchUsers(""); }, []);

  function editEntry(entry: Entry) { setEditingId(entry.id); setMode(entry.cameraMode); setUserId(entry.userId); setTitle(entry.title ?? ""); setDescription(entry.description ?? ""); setSettingsFile(null); setVideoFile(null); setVideoUrl(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function resetForm() { setEditingId(""); setMode("lock"); setUserId(""); setSettingsFile(null); setVideoFile(null); setVideoUrl(""); setTitle(""); setDescription(""); setError(""); }

  async function save() {
    setError("");
    if (!userId) return setError("Choose a connected Rhythia profile.");
    if (!editingId && (!settingsFile || (!videoFile && !videoUrl.trim()))) return setError("Choose a connected profile, RHS file, and either a gameplay video file or external video URL.");
    if (videoFile && videoUrl.trim()) return setError("Choose either a video file or an external video URL, not both.");
    if (settingsFile && !/\.rhs$/i.test(settingsFile.name)) return setError("Settings file must be an .rhs file.");
    if (videoFile && !/\.(mp4|webm|mov|m4v)$/i.test(videoFile.name)) return setError("Gameplay preview must be MP4, WebM, MOV, or M4V.");
    setBusy(true);
    try {
      let uploadData: Record<string, string> = {};
      if (settingsFile || videoFile) {
        const prepare = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload", settingsFileName: settingsFile?.name, settingsFileSize: settingsFile?.size, videoFileName: videoFile?.name, videoFileSize: videoFile?.size }) });
        const prepared = await prepare.json();
        if (!prepare.ok) throw new Error(prepared.error ?? "Could not prepare uploads.");
        uploadData = prepared;
        if (settingsFile && uploadData.settingsUploadUrl) await uploadFileToSignedStorageUrl(uploadData.settingsUploadUrl, settingsFile);
        if (videoFile && uploadData.videoUploadUrl) await uploadFileToSignedStorageUrl(uploadData.videoUploadUrl, videoFile);
      }
      const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: editingId ? "update" : "create", id: editingId || undefined, cameraMode: mode, userId, settingsPath: uploadData.settingsPath, videoPath: uploadData.videoPath, externalVideoUrl: videoUrl.trim(), settingsFileName: settingsFile?.name, title, description }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save settings.");
      resetForm(); await load();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not save settings."); } finally { setBusy(false); }
  }

  async function remove(id: string) { if (!confirm("Delete this community settings entry?")) return; const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); const data = await response.json().catch(() => null); if (!response.ok) { setError(data?.error || "Could not delete community settings entry."); return; } if (editingId === id) resetForm(); await load(); }
  const selectedProfile = users.find((profile) => profile.userId === userId);

  return <div className="ui-page space-y-6">
    <div className="ui-panel"><h1 className="text-3xl font-semibold text-white">System settings</h1><p className="mt-3 text-sm leading-7 text-muted">Configure branding, feature flags, integrations, and player settings showcases.</p></div>
    <section className="rounded-3xl border border-border bg-surface/95 p-7 shadow-glow">
      <p className="ui-eyebrow">Community Settings Showcase</p><h2 className="mt-2 text-2xl font-black text-white">{editingId ? "Edit community settings" : "Add community settings"}</h2><p className="mt-2 text-sm text-muted">Upload an RHS file and use either a video file or TikTok, YouTube, Twitch, or Medal.tv URL for the gameplay preview.</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Camera mode</label><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setMode("lock")} className={`rounded-xl px-4 py-3 font-bold ${mode === "lock" ? "bg-accent text-white" : "border border-border text-muted"}`}>Lock</button><button onClick={() => setMode("spin")} className={`rounded-xl px-4 py-3 font-bold ${mode === "spin" ? "bg-accent text-white" : "border border-border text-muted"}`}>Spin</button></div></div>
        <div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Connected Rhythia profile</label><input value={query} onChange={(event) => void searchUsers(event.target.value)} placeholder="Search Rhythia name, Rhythians name, or handle..." className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white outline-none focus:border-accent" /><select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white"><option value="">{profilesLoading ? "Loading profiles..." : users.length ? "Choose connected profile" : "No connected profiles found"}</option>{users.map((profile) => <option key={profile.userId} value={profile.userId}>{profile.username || profile.user.displayName || profile.user.username} · {profile.globalRank ? `Global #${profile.globalRank.toLocaleString()}` : "Rank unavailable"} · @{profile.user.profileHandle}</option>)}</select>{selectedProfile ? <p className="mt-2 text-xs text-muted">Rhythia profile #{selectedProfile.profileId} · {selectedProfile.user.displayName || selectedProfile.user.username}</p> : null}</div>
        <div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Settings file {editingId && "(optional replacement)"}</label><input type="file" accept=".rhs,application/octet-stream" onChange={(event) => setSettingsFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div>
        <div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Gameplay video file {editingId && "(optional replacement)"}</label><input type="file" accept={videoAccept} onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div>
        <div className="lg:col-span-2"><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Or external gameplay video URL</label><input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="TikTok, YouTube, Twitch, or Medal.tv URL" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white outline-none focus:border-accent" /></div>
        <div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Title</label><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div><div><label className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Optional player/settings information" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></div>
      </div>
      {editingId ? <p className="mt-4 rounded-xl border border-accent/20 bg-accent/10 p-3 text-sm text-accent">Each file can now be replaced independently. Leave a field empty to keep the current asset.</p> : null}{error ? <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}<div className="mt-5 flex gap-2"><button disabled={busy} onClick={() => void save()} className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving..." : editingId ? "Save changes" : "Publish settings"}</button>{editingId ? <button disabled={busy} onClick={resetForm} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted hover:text-white">Cancel edit</button> : null}</div>
    </section>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-white">Published community settings</h2><span className="text-sm text-muted">{entries.length} entries</span></div>{entries.map((entry) => <div key={entry.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/90 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-bold text-white">{entry.profileUsername || entry.displayName || entry.username} · {entry.cameraMode}</p><p className="truncate text-sm text-muted">{entry.globalRank ? `Rhythia #${entry.globalRank.toLocaleString()}` : "Rank unavailable"} · {entry.settingsFileName}{entry.title ? ` · ${entry.title}` : ""}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => editEntry(entry)} className="inline-flex items-center gap-2 rounded-xl border border-accent/30 px-3 py-2 text-sm font-semibold text-accent"><Pencil size={15} /> Edit</button><button onClick={() => void remove(entry.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-200"><Trash2 size={15} /> Delete</button></div></div>)}</section>
    <MessageSettings />
  </div>;
}
