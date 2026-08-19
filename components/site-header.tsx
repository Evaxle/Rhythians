import Link from "next/link";
import { Menu, Search, MessageCircle } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canAccessApproval } from "@/lib/approval";
import { canAccessAdmin } from "@/lib/admin-access";
import { NotificationsBell } from "@/components/notifications-bell";
import { ProfileMenu } from "@/components/profile-menu";
import { version } from "@/package.json";

export async function SiteHeader() {
  const user = await getSessionUser();
  const hasApprovalAccess = user ? await canAccessApproval(user) : false;
  const isAdmin = user ? await canAccessAdmin(user) : false;

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4 lg:px-6 2xl:gap-5 2xl:px-8">
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-semibold text-white sm:gap-3 sm:text-lg"><img src="/favicon.ico" alt="Rhythians" className="h-10 w-10 shrink-0 rounded-2xl sm:h-11 sm:w-11" /><span>Rhythians<span className="hidden sm:inline"> Beta</span></span></Link>
          <span className="hidden whitespace-nowrap rounded-full border border-border bg-white/5 px-2 py-1 text-[10px] font-semibold tracking-wide text-muted xl:inline">v{version}</span>
        </div>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 2xl:flex">
          <Link href="/" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Home</Link>
          <Link href="/daily" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Daily</Link>
          <Link href="/maps" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Maps</Link>
          <Link href="/categories?tab=challenge" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Challenge</Link>
          <Link href="/leaderboards" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Leaderboards</Link>
          <Link href="/online" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Online</Link>
          <Link href="/wiki" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Wiki</Link>
          <Link href="/clips" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Clips</Link>
          <Link href="/rules" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Rules</Link>
          <Link href="/community" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Community</Link>
          {user && <Link href="/messages" className="whitespace-nowrap text-xs text-muted transition hover:text-white">Messages</Link>}
          {hasApprovalAccess && <Link href="/approval" className="whitespace-nowrap text-xs text-accent transition hover:text-white">Review</Link>}
          {isAdmin && <Link href="/admin" className="whitespace-nowrap text-xs font-semibold text-accent transition hover:text-white">Admin</Link>}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
          <details className="relative 2xl:hidden"><summary className="flex h-10 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-white/5 px-3 text-sm text-muted transition hover:border-accent/40 hover:text-white [&::-webkit-details-marker]:hidden" aria-label="Open navigation menu"><Menu size={18} /><span className="ml-2 hidden sm:inline">Menu</span></summary><nav className="absolute right-0 z-50 mt-2 grid w-56 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-xl"><Link href="/" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Home</Link><Link href="/daily" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Daily</Link><Link href="/maps" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Maps</Link><Link href="/categories?tab=challenge" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Challenge</Link><Link href="/leaderboards" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Leaderboards</Link><Link href="/online" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Online</Link><Link href="/wiki" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Wiki</Link><Link href="/clips" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Clips</Link><Link href="/rules" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Rules</Link><Link href="/community" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Community</Link>{user && <Link href="/messages" className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-white">Messages</Link>}{hasApprovalAccess && <Link href="/approval" className="rounded-xl px-3 py-2 text-sm text-accent transition hover:bg-white/5 hover:text-white">Review</Link>}{isAdmin && <Link href="/admin" className="rounded-xl px-3 py-2 text-sm font-semibold text-accent transition hover:bg-white/5 hover:text-white">Admin</Link>}</nav></details>
          <Link href="/search" aria-label="Search" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-white/5 px-3 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white sm:px-4"><Search size={16} /><span className="hidden sm:inline">Search</span></Link>
          {user && <NotificationsBell />}
          {user ? <ProfileMenu user={user} /> : <Link href="/login" aria-label="Log in" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-accent2 sm:px-4"><MessageCircle size={16} /><span className="hidden sm:inline">Login</span></Link>}
        </div>
      </div>
    </header>
  );
}
