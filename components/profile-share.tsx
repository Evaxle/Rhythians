"use client";

import { Check, Share2, X } from "lucide-react";
import { useState } from "react";

export function ProfileShare({ userId, progress, earned }: { userId: string; progress: number; earned: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redeemed, setRedeemed] = useState(earned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/share-${userId}`;

  async function copyLink() {
    setError("");
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the link. You can select it manually.");
    }
  }

  async function redeem() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile/referral/redeem", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not redeem the tag.");
      setRedeemed(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not redeem the tag.");
    } finally {
      setBusy(false);
    }
  }

  if (redeemed) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="text-xs font-semibold text-muted">{Math.min(progress, 5)}/5</div>
      {progress >= 5 && <button type="button" onClick={() => void redeem()} disabled={busy} aria-label="Redeem Contributor tag" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"><Check size={14} /></button>}
      <button type="button" onClick={() => { setOpen(true); setError(""); }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-accent/40 hover:bg-accent/10"><Share2 size={13} /> Share</button>
      {error && <p className="max-w-56 text-right text-[11px] text-red-300">{error}</p>}
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}><div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.25em] text-accent">Share your profile</p><h2 className="mt-2 text-xl font-semibold text-white">Invite people to Rhythians</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-white/5 hover:text-white"><X size={18} /></button></div><p className="mt-4 text-sm leading-6 text-muted">Send your personal link to people who do not have an account. When someone uses your link and creates a Rhythians account, it counts toward your Contributor tag. Get 5 successful sign-ups to unlock the tag.</p><div className="mt-5 rounded-2xl border border-border bg-background/70 p-3"><p className="break-all text-xs text-white">{link}</p></div><button type="button" onClick={() => void copyLink()} className="mt-4 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2">{copied ? "Copied" : "Copy share link"}</button><p className="mt-3 text-center text-xs text-muted">Progress: {Math.min(progress, 5)}/5 successful sign-ups</p></div></div>}
    </div>
  );
}
