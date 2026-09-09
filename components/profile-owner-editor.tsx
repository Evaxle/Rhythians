"use client";

import { useState } from "react";
import { Pencil, RefreshCw, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
  username: string;
  displayName: string | null;
  profileHandle: string;
  bio: string | null;
  website: string | null;
  rhp: number;
  title: string | null;
  titleColor: string | null;
  titleNeon: boolean;
  rhythiaProfileUrl: string | null;
  rhythiaUsername: string | null;
};

export function ProfileOwnerEditor(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(props.username);
  const [displayName, setDisplayName] = useState(props.displayName ?? "");
  const [profileHandle, setProfileHandle] = useState(props.profileHandle);
  const [bio, setBio] = useState(props.bio ?? "");
  const [website, setWebsite] = useState(props.website ?? "");
  const [rhp, setRhp] = useState(String(props.rhp));
  const [title, setTitle] = useState(props.title ?? "");
  const [titleColor, setTitleColor] = useState(props.titleColor ?? "#a78bfa");
  const [titleNeon, setTitleNeon] = useState(props.titleNeon);
  const [rhythiaUrl, setRhythiaUrl] = useState(props.rhythiaProfileUrl ?? "");
  const [linkedRhythia, setLinkedRhythia] = useState(Boolean(props.rhythiaProfileUrl));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveProfile() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/owner/users/${encodeURIComponent(props.userId)}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, profileHandle, bio, website, rhp, title, titleColor, titleNeon }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the profile.");
      setMessage("Profile information updated.");
      if (data.user?.profileHandle && data.user.profileHandle !== props.profileHandle) {
        router.replace(`/profile/${encodeURIComponent(data.user.profileHandle)}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the profile.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRhythia() {
    if (!rhythiaUrl.trim()) return setMessage("Enter a Rhythia profile URL first.");
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/rhythia-requests/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", userId: props.userId, profileUrl: rhythiaUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the Rhythia link.");
      setLinkedRhythia(true);
      setMessage(`Rhythia account linked${data.profile?.username ? ` to ${data.profile.username}` : ""}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the Rhythia link.");
    } finally {
      setBusy(false);
    }
  }

  async function unlinkRhythia() {
    if (!confirm("Unlink this user's Rhythia account and reset linked-profile ranking data?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/rhythia-requests/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink", userId: props.userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not unlink the Rhythia account.");
      setLinkedRhythia(false);
      setRhythiaUrl("");
      setMessage("Rhythia account unlinked.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not unlink the Rhythia account.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mb-6 rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-5 shadow-glow">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Owner controls</p><h2 className="mt-1 text-lg font-semibold text-white">Edit this user directly</h2><p className="mt-1 text-xs text-muted">Only the configured site owner can see or use these profile-page controls.</p></div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-200"><Pencil size={14} /> {open ? "Close editor" : "Edit user"}</button>
    </div>

    {open && <div className="mt-5 space-y-5 border-t border-amber-300/15 pt-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-xs font-semibold text-white">Username<input value={username} onChange={(event) => setUsername(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white" /></label>
        <label className="grid gap-2 text-xs font-semibold text-white">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white" /></label>
        <label className="grid gap-2 text-xs font-semibold text-white">Profile handle<input value={profileHandle} onChange={(event) => setProfileHandle(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white" /></label>
        <label className="grid gap-2 text-xs font-semibold text-white">Website<input value={website} onChange={(event) => setWebsite(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white" /></label>
        <label className="grid gap-2 text-xs font-semibold text-white">RHP override<input type="number" min="0" max="1000000" value={rhp} onChange={(event) => setRhp(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white" /></label>
        <label className="grid gap-2 text-xs font-semibold text-white">Profile title<input value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white" /></label>
        <label className="grid gap-2 text-xs font-semibold text-white">Title color<input type="color" value={titleColor} onChange={(event) => setTitleColor(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background p-1" /></label>
        <label className="flex items-center gap-2 self-end rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold text-white"><input type="checkbox" checked={titleNeon} onChange={(event) => setTitleNeon(event.target.checked)} className="h-4 w-4 accent-accent" /> Neon title glow</label>
      </div>
      <label className="grid gap-2 text-xs font-semibold text-white">Bio<textarea value={bio} maxLength={500} rows={4} onChange={(event) => setBio(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-white" /></label>
      <button type="button" disabled={busy} onClick={() => void saveProfile()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Save profile information</button>

      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Linked Rhythia account</p>
        <p className="mt-1 text-sm text-white">{linkedRhythia ? `Currently linked${props.rhythiaUsername ? ` to ${props.rhythiaUsername}` : ""}.` : "No Rhythia account is linked."}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={rhythiaUrl} onChange={(event) => setRhythiaUrl(event.target.value)} placeholder="https://www.rhythia.com/player/..." className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white" /><button type="button" disabled={busy || !rhythiaUrl.trim()} onClick={() => void saveRhythia()} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{linkedRhythia ? "Replace Rhythia link" : "Link Rhythia"}</button>{linkedRhythia && <button type="button" disabled={busy} onClick={() => void unlinkRhythia()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-50"><Unlink size={14} /> Unlink</button>}</div>
      </div>
      {message && <p className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-muted">{message}</p>}
    </div>}
  </section>;
}
