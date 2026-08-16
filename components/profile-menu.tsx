"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

interface ProfileMenuUser {
  avatar: string | null;
  discordId: string | null;
  username: string;
  displayName: string | null;
  profileHandle: string;
}

const CLOSE_DELAY_MS = 250;

export function ProfileMenu({ user }: { user: ProfileMenuUser }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function openMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(true);
  }

  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  const avatarUrl = user.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : user.discordId
        ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
        : null
    : null;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen((current) => !current)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-white/5 px-2 py-1.5 text-sm text-white transition hover:border-accent/40"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${user.username}'s avatar`}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-28 truncate sm:inline">{user.displayName ?? user.username}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="animate-rise-in absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-glow">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-semibold text-white">{user.displayName ?? user.username}</p>
            <p className="truncate text-xs text-muted">@{user.profileHandle}</p>
          </div>
          <Link href={`/profile/${user.profileHandle}`} className="mt-1 block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">
            View profile
          </Link>
          <Link href="/messages" className="block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">
            Messages
          </Link>
          <Link href="/notifications" className="block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">
            Notifications
          </Link>
          <Link href="/settings" className="block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">
            Settings
          </Link>
          <a href="/api/auth/logout" className="block rounded-xl px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200">
            Log out
          </a>
        </div>
      )}
    </div>
  );
}
