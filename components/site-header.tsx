import Link from "next/link";
import { Search, MessageCircle } from "lucide-react";
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
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap text-lg font-semibold text-white">
            <img src="/favicon.ico" alt="Rhythians" className="h-11 w-11 shrink-0 rounded-2xl" />
            <span>Rhythians Beta</span>
          </Link>
          <span className="whitespace-nowrap rounded-full border border-border bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-muted">v{version}</span>
        </div>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-3 lg:flex xl:gap-4">
          <Link href="/" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Home</Link>
          <Link href="/daily" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Daily</Link>
          <Link href="/maps" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Maps</Link>
          <Link href="/categories" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Challenge</Link>
          <Link href="/leaderboards" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Leaderboards</Link>
          <Link href="/wiki" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Wiki</Link>
          <Link href="/clips" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Clips</Link>
          <Link href="/rules" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Rules</Link>
          <Link href="/community" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Community</Link>
          {user && <Link href="/messages" className="whitespace-nowrap text-sm text-muted transition hover:text-white">Messages</Link>}
          {hasApprovalAccess && <Link href="/approval" className="whitespace-nowrap text-sm text-accent transition hover:text-white">Review</Link>}
          {isAdmin && <Link href="/admin" className="whitespace-nowrap text-sm font-semibold text-accent transition hover:text-white">Admin</Link>}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <Link href="/search" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white"><Search size={16} /> Search</Link>
          {user && <NotificationsBell />}
          {user ? <ProfileMenu user={user} /> : <Link href="/login" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2"><MessageCircle size={16} /> Login</Link>}
        </div>
      </div>
    </header>
  );
}
