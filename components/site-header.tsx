import Link from "next/link";
import { Search, MessageCircle } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canAccessApproval } from "@/lib/approval";
import { canAccessAdmin } from "@/lib/admin-access";
import { NotificationsBell } from "@/components/notifications-bell";
import { ProfileMenu } from "@/components/profile-menu";

export async function SiteHeader() {
  const user = await getSessionUser();
  const hasApprovalAccess = user ? await canAccessApproval(user) : false;
  const isAdmin = user ? await canAccessAdmin(user) : false;

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
            <img src="/favicon.ico" alt="Rhythians" className="h-11 w-11 rounded-2xl" />
            Rhythians Beta
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/" className="text-sm text-muted transition hover:text-white">Home</Link>
            <Link href="/knowledge" className="text-sm text-muted transition hover:text-white">Knowledge</Link>
            <Link href="/clips" className="text-sm text-muted transition hover:text-white">Clips</Link>
            <Link href="/rules" className="text-sm text-muted transition hover:text-white">Rules</Link>
            <Link href="/community" className="text-sm text-muted transition hover:text-white">Community</Link>
            {user && (
              <Link href="/messages" className="text-sm text-muted transition hover:text-white">Messages</Link>
            )}
            {hasApprovalAccess && (
              <Link href="/approval" className="text-sm text-accent transition hover:text-white">Review</Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="text-sm font-semibold text-accent transition hover:text-white">Admin</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">
            <Search size={16} /> Search
          </Link>
          {user && <NotificationsBell />}
          {user ? (
            <ProfileMenu user={user} />
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
