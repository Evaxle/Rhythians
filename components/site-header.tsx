import Link from "next/link";
import { Search, MessageCircle } from "lucide-react";
import { SiteNavigation } from "@/components/site-navigation";
import { canAccessApproval } from "@/lib/approval";
import { canAccessAdmin } from "@/lib/admin-access";
import { NotificationsBell } from "@/components/notifications-bell";
import { ProfileMenu } from "@/components/profile-menu";
import type { getSessionUser } from "@/lib/auth";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
function DiscordIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M19.54 5.34A16.3 16.3 0 0 0 15.44 4a11.2 11.2 0 0 0-.53 1.09 15.2 15.2 0 0 0-5.81 0A11.9 11.9 0 0 0 8.56 4c-1.44.25-2.82.7-4.1 1.34C1.87 9.15 1.17 12.86 1.52 16.5a16.6 16.6 0 0 0 5.03 2.54c.41-.56.77-1.15 1.08-1.78a10.7 10.7 0 0 1-1.7-.82l.42-.33a11.65 11.65 0 0 0 11.3 0l.43.33c-.55.32-1.12.6-1.7.82.31.63.67 1.22 1.08 1.78a16.5 16.5 0 0 0 5.02-2.54c.42-4.22-.72-7.9-2.94-11.16ZM8.5 14.27c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27 2.02 1.03 2 2.27c0 1.25-.89 2.27-2 2.27Zm7 0c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27 2.02 1.03 2 2.27c0 1.25-.88 2.27-2 2.27Z" />
    </svg>
  );
}

export async function SiteHeader({ user }: { user: SessionUser | null }) {
  const [hasApprovalAccess, isAdmin] = user
    ? await Promise.all([canAccessApproval(user), canAccessAdmin(user)])
    : [false, false];

  return (
    <header className="site-header">
      <div className="site-header-inner mx-auto flex max-w-[1440px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 lg:px-7 2xl:px-9">
        <Link
          href="/"
          prefetch
          className="group flex shrink-0 items-center gap-2.5 rounded-2xl px-1.5 py-1.5 sm:gap-3"
        >
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-indigo-400 shadow-[0_8px_30px_rgba(124,143,240,0.25)] ring-1 ring-white/10 sm:h-11 sm:w-11">
            <img
              src="/favicon.ico"
              alt="Rhythians"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          </span>
          <span className="site-brand-text hidden text-[15px] font-bold tracking-tight text-white sm:block sm:text-base">
            Rhythians
          </span>
        </Link>

        <SiteNavigation
          signedIn={Boolean(user)}
          approval={hasApprovalAccess}
          admin={isAdmin}
        />

        <div className="site-header-actions ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href="https://discord.gg/sNJJ3PEKx"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join Rhythians Discord"
            title="Join Rhythians Discord"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-muted transition hover:border-[#5865F2]/50 hover:bg-[#5865F2]/15 hover:text-[#8b95ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]/50"
          >
            <DiscordIcon />
          </a>
          <Link
            href="/search"
            prefetch
            aria-label="Search"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-muted hover:border-white/20 hover:bg-white/[0.07] hover:text-white sm:px-3.5"
          >
            <Search size={16} />
            <span className="site-search-label hidden lg:inline">Search</span>
          </Link>
          {user && <NotificationsBell />}
          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <Link
              href="/login"
              prefetch
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,143,240,0.2)] hover:bg-accent2 sm:px-4"
            >
              <MessageCircle size={16} />
              <span className="site-login-label hidden sm:inline">Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
