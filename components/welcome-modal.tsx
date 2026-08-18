"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, MessageCircle, BookOpen, Video, ShieldCheck, Link2, LogIn } from "lucide-react";

const STORAGE_KEY = "rhythians_welcome_dismissed";
const DISCORD_INVITE = "https://discord.gg/Q88NM7XhJ";

export function WelcomeModal({ user, hasLinkedProfile, profileHandle }: { user: boolean; hasLinkedProfile: boolean; profileHandle: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Rhythians"
    >
      <div
        className="animate-modal-in relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-glow"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close welcome"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-white"
        >
          <X size={18} />
        </button>

        <p className="text-sm uppercase tracking-[0.3em] text-accent">Welcome</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Welcome to Rhythians!</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          A home for the Discord community — knowledge, clips, ranked maps, and everything in between.
        </p>

        <div className="mt-6 space-y-4">
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-accent/30 bg-accent/10 p-4 transition hover:bg-accent/20"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <MessageCircle size={20} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">Join the Discord server</span>
              <span className="block text-xs text-muted">Stay connected with the community outside the website.</span>
            </span>
          </a>

          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={16} className="text-accent" /> Sign in
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              Sign in with your Discord account to get your roles and tags automatically — or create a normal account if
              you don&apos;t have Discord.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/login"
                onClick={dismiss}
                className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent2"
              >
                Sign in with Discord
              </Link>
              <Link
                href="/register"
                onClick={dismiss}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-white"
              >
                Create an account
              </Link>
            </div>
          </div>

          {user && !hasLinkedProfile && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Link2 size={16} /> Link your Rhythia account
              </p>
              <p className="mt-2 text-xs leading-6 text-amber-100/80">
                Daily maps, ranked maps, and leaderboards are only available with a linked Rhythia profile. Link yours
                to start earning Rhythian Points.
              </p>
              <Link
                href={profileHandle ? `/profile/${profileHandle}` : "/login"}
                onClick={dismiss}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30"
              >
                <Link2 size={14} /> Link your account
              </Link>
            </div>
          )}

          {!user && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <LogIn size={16} /> Daily maps & ranked ladder
              </p>
              <p className="mt-2 text-xs leading-6 text-amber-100/80">
                Sign in and link your Rhythia account to play daily maps, ranked challenge maps, and climb the leaderboards.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <BookOpen size={16} className="text-accent" /> Wiki
              </p>
              <p className="mt-2 text-xs leading-6 text-muted">Guides, FAQs, and resources for the community.</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <Video size={16} className="text-accent" /> Clips
              </p>
              <p className="mt-2 text-xs leading-6 text-muted">
                Browse approved clips, or submit your own for review.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-white transition hover:border-accent/40"
        >
          Got it, let&apos;s go!
        </button>
      </div>
    </div>
  );
}