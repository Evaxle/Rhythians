"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, BookOpen, Video, Link2, LogIn, Trophy, Swords, Settings2, Smartphone, Map } from "lucide-react";

const STORAGE_KEY = "rhythians_welcome_dismissed_v2";

export function WelcomeModal({ user, hasLinkedProfile, profileHandle }: { user: boolean; hasLinkedProfile: boolean; profileHandle: string | null }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
      } catch { setOpen(true); }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className="m-auto w-[calc(100%_-_2rem)] max-w-2xl overflow-visible border-0 bg-transparent p-0 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm" onCancel={(event) => { event.preventDefault(); dismiss(); }} onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }} aria-label="Welcome to Rhythians">
      <div className="animate-modal-in relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-glow sm:p-8" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={dismiss} aria-label="Close welcome" className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-white"><X size={18} /></button>

        <p className="ui-eyebrow">Welcome</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Welcome to Rhythians</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">Track your Rhythia progress, compete, discover maps, share clips, compare player settings, and take part in community events from one account.</p>

        {!user ? (
          <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><LogIn size={16} className="text-accent" /> Sign in or create an account</p>
            <p className="mt-2 text-xs leading-6 text-muted">Use Google or the standard account flow, then link your Rhythia profile to unlock automatic classification, live Rhythia information, ranked features, battles, and tournaments.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/login" onClick={dismiss} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent2">Sign in</Link>
              <Link href="/register" onClick={dismiss} className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-white">Create account</Link>
            </div>
          </div>
        ) : !hasLinkedProfile ? (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Link2 size={16} /> Link your Rhythia account</p>
            <p className="mt-2 text-xs leading-6 text-amber-100/80">Linking your Rhythia profile enables live rank information, automatic player classification, map progress, battles, tournaments, and leaderboard placement.</p>
            <Link href={profileHandle ? `/profile/${profileHandle}` : "/settings"} onClick={dismiss} className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30"><Link2 size={14} /> Link Rhythia profile</Link>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/tournaments" onClick={dismiss} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-accent/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Trophy size={16} className="text-accent" /> Tournaments</p>
            <p className="mt-2 text-xs leading-6 text-muted">Sign up by split, follow brackets, play assigned matches, and advance through tournament rounds.</p>
          </Link>
          <Link href="/battles" onClick={dismiss} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-accent/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Swords size={16} className="text-accent" /> Battles</p>
            <p className="mt-2 text-xs leading-6 text-muted">Match against players near your level and submit verified Rhythia results.</p>
          </Link>
          <Link href="/maps" onClick={dismiss} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-accent/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Map size={16} className="text-accent" /> Maps & progression</p>
            <p className="mt-2 text-xs leading-6 text-muted">Browse ranked and challenge maps, track completions, earn RHP, and climb Rhythians leaderboards.</p>
          </Link>
          <Link href="/clips" onClick={dismiss} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-accent/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Video size={16} className="text-accent" /> Clips</p>
            <p className="mt-2 text-xs leading-6 text-muted">Browse community clips or submit file uploads, TikTok videos, YouTube videos, and Twitch clips.</p>
          </Link>
          <Link href="/community-settings" onClick={dismiss} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-accent/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Settings2 size={16} className="text-accent" /> Community settings</p>
            <p className="mt-2 text-xs leading-6 text-muted">Compare featured player settings, watch looping gameplay previews, and download RHS files.</p>
          </Link>
          <Link href="/wiki" onClick={dismiss} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-accent/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><BookOpen size={16} className="text-accent" /> Wiki</p>
            <p className="mt-2 text-xs leading-6 text-muted">Guides, explanations, resources, and community knowledge for Rhythia players.</p>
          </Link>
          <Link href="/mobile" onClick={dismiss} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-accent/40 sm:col-span-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Smartphone size={16} className="text-accent" /> Mobile app experience</p>
            <p className="mt-2 text-xs leading-6 text-muted">Install Rhythians to your phone home screen for a standalone mobile experience using the same account and live site data.</p>
          </Link>
        </div>

        <button type="button" onClick={dismiss} className="mt-6 w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40">Explore Rhythians</button>
      </div>
    </dialog>
  );
}
