import Link from "next/link";
import { Search, MessageCircle } from "lucide-react";
import { getSessionUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
              R
            </div>
            Rhythians
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/" className="text-sm text-muted transition hover:text-white">Home</Link>
            <Link href="/knowledge" className="text-sm text-muted transition hover:text-white">Knowledge</Link>
            <Link href="/clips" className="text-sm text-muted transition hover:text-white">Clips</Link>
            <Link href="/rules" className="text-sm text-muted transition hover:text-white">Rules</Link>
            <Link href="/community" className="text-sm text-muted transition hover:text-white">Community</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">
            <Search size={16} /> Search
          </Link>
          {user ? (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-white/5 px-2 py-1.5 text-sm text-white transition hover:border-accent/40 [&::-webkit-details-marker]:hidden">
                {user.avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`}
                    alt={`${user.username}'s Discord avatar`}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-28 truncate sm:inline">{user.displayName ?? user.username}</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-glow">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-semibold text-white">{user.displayName ?? user.username}</p>
                  <p className="truncate text-xs text-muted">@{user.profileHandle}</p>
                </div>
                <Link href={`/profile/${user.profileHandle}`} className="mt-1 block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">
                  View profile
                </Link>
                <Link href="/settings" className="block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">
                  Settings
                </Link>
                <a href="/api/auth/logout" className="block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">
                  Log out
                </a>
              </div>
            </details>
          ) : (
            <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2">
              <MessageCircle size={16} /> Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
