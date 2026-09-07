import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Film,
  Home,
  Map as MapIcon,
  Medal,
  Menu,
  MessageCircle,
  Route,
  ScrollText,
  Search,
  Settings2,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { canAccessApproval } from "@/lib/approval";
import { canAccessAdmin } from "@/lib/admin-access";
import { NotificationsBell } from "@/components/notifications-bell";
import { ProfileMenu } from "@/components/profile-menu";
import { UnreadIndicator } from "@/components/messages/unread-indicator";
import { version } from "@/package.json";
import type { getSessionUser } from "@/lib/auth";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
type NavLink = { href: string; label: string; icon: LucideIcon; elevated?: boolean };

const links: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/daily", label: "Daily", icon: CalendarDays },
  { href: "/path", label: "Path", icon: Route },
  { href: "/maps", label: "Maps", icon: MapIcon },
  { href: "/categories?tab=challenge", label: "Challenge", icon: Target },
  { href: "/battles", label: "Battles", icon: Swords },
  { href: "/tournaments", label: "Tournaments", icon: Medal },
  { href: "/online", label: "Online", icon: Users },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/leaderboards", label: "Leaderboards", icon: Trophy },
  { href: "/clips", label: "Clips", icon: Film },
  { href: "/rules", label: "Rules", icon: ScrollText },
  { href: "/community-settings", label: "Community Settings", icon: Settings2 },
];

export async function SiteHeader({ user }: { user: SessionUser | null }) {
  const [hasApprovalAccess, isAdmin] = user
    ? await Promise.all([canAccessApproval(user), canAccessAdmin(user)])
    : [false, false];
  const extraLinks: NavLink[] = [
    ...(user ? [{ href: "/messages", label: "Friends", icon: MessageCircle }] : []),
    ...(hasApprovalAccess ? [{ href: "/approval", label: "Review", icon: ClipboardCheck, elevated: true }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield, elevated: true }] : []),
  ];
  const allLinks = [...links, ...extraLinks];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b14]/82 shadow-[0_10px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
      <div className="site-header-inner mx-auto flex max-w-[1700px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 lg:px-7 2xl:px-9">
        <Link href="/" prefetch className="group flex shrink-0 items-center gap-2.5 rounded-2xl px-1.5 py-1.5 sm:gap-3">
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-indigo-400 shadow-[0_8px_30px_rgba(124,143,240,0.25)] ring-1 ring-white/10 sm:h-11 sm:w-11">
            <img src="/favicon.ico" alt="Rhythians" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          </span>
          <span className="site-brand-text hidden text-[15px] font-bold tracking-tight text-white sm:block sm:text-base">Rhythians</span>
          <span className="site-brand-meta hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted xl:inline">Beta</span>
          <span className="site-brand-meta hidden text-[10px] font-medium text-muted 2xl:inline">v{version}</span>
        </Link>

        <nav className="site-desktop-nav hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Primary navigation">
          {allLinks.map(({ href, label, icon: Icon, elevated }) => (
            <Link
              key={href}
              href={href}
              prefetch
              aria-label={label}
              title={label}
              className={`group/nav relative inline-flex h-10 shrink-0 items-center overflow-hidden rounded-xl border border-transparent px-3 transition-[color,background-color,border-color,box-shadow] duration-300 ease-out hover:border-white/10 hover:bg-white/[0.07] hover:text-white hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] focus-visible:border-accent/40 focus-visible:bg-white/[0.07] focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${elevated ? "text-accent" : "text-muted"}`}
            >
              <Icon className="shrink-0 transition duration-300 ease-out group-hover/nav:scale-110 group-hover/nav:text-accent group-focus-visible/nav:scale-110 group-focus-visible/nav:text-accent" size={17} strokeWidth={2} />
              <span className="max-w-0 translate-x-1.5 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-[max-width,margin,opacity,transform] duration-300 ease-out group-hover/nav:ml-2 group-hover/nav:max-w-36 group-hover/nav:translate-x-0 group-hover/nav:opacity-100 group-focus-visible/nav:ml-2 group-focus-visible/nav:max-w-36 group-focus-visible/nav:translate-x-0 group-focus-visible/nav:opacity-100">
                {label}
              </span>
              {label === "Friends" && <UnreadIndicator />}
              <span className="pointer-events-none absolute inset-x-3 bottom-0 h-px origin-center scale-x-0 bg-gradient-to-r from-transparent via-accent to-transparent transition-transform duration-300 group-hover/nav:scale-x-100 group-focus-visible/nav:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="site-header-actions ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <details className="site-mobile-nav relative xl:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-muted hover:border-white/20 hover:bg-white/[0.07] hover:text-white [&::-webkit-details-marker]:hidden" aria-label="Open navigation menu">
              <Menu size={17} />
              <span className="site-mobile-menu-label hidden sm:inline">Menu</span>
              <ChevronDown size={14} className="site-mobile-menu-label hidden sm:inline" />
            </summary>
            <nav className="site-mobile-menu-panel absolute right-0 mt-2 grid w-72 gap-1 rounded-2xl border border-white/10 bg-[#101629]/95 p-2 shadow-2xl backdrop-blur-2xl" aria-label="Mobile navigation">
              {allLinks.map(({ href, label, icon: Icon, elevated }) => (
                <Link key={href} href={href} prefetch className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition hover:bg-white/[0.06] hover:text-white ${elevated ? "text-accent" : "text-muted"}`}>
                  <Icon size={17} className="shrink-0" />
                  <span>{label}</span>
                  {label === "Friends" && <UnreadIndicator />}
                </Link>
              ))}
            </nav>
          </details>
          <Link href="/search" prefetch aria-label="Search" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-muted hover:border-white/20 hover:bg-white/[0.07] hover:text-white sm:px-3.5">
            <Search size={16} />
            <span className="site-search-label hidden lg:inline">Search</span>
          </Link>
          {user && <NotificationsBell />}
          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <Link href="/login" prefetch className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,143,240,0.2)] hover:bg-accent2 sm:px-4">
              <MessageCircle size={16} />
              <span className="site-login-label hidden sm:inline">Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
