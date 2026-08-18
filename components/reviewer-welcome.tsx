"use client";

import { useEffect, useState } from "react";
import { X, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "rhythians_reviewer_welcome_dismissed";

export function ReviewerWelcome() {
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
      aria-label="Review panel guide"
    >
      <div
        className="animate-modal-in relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-glow"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close guide"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-white"
        >
          <X size={18} />
        </button>

        <p className="text-sm uppercase tracking-[0.3em] text-accent">Review team</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Welcome, post reviewer!</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          You&apos;re now part of the review team. Here&apos;s how reviewing works and what&apos;s expected of you.
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 size={16} className="text-emerald-400" /> How it works
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              Review pending clip submissions below. Approve clips that follow the community rules, or deny them with
              feedback so the uploader knows what to fix before resubmitting. Uploaders are notified either way.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={16} className="text-accent" /> Rules
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              Only approve content that is appropriate and on-topic — no NSFW, hateful, harmful, or spam material. When
              in doubt, deny it with feedback or leave it for the owner to review.
            </p>
          </div>

          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-200">
              <AlertTriangle size={16} /> Punishments
            </p>
            <p className="mt-2 text-xs leading-6 text-red-100/80">
              Deliberately approving inappropriate posts is a serious offense. Depending on severity, you can lose your
              review role, receive a warning, or be banned from the server and website.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2"
        >
          I understand — start reviewing
        </button>
      </div>
    </div>
  );
}