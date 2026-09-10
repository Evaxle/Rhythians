import Link from "next/link";
import {
  BookOpen, CalendarDays, ChevronDown, ClipboardCheck, Film, Home, Lightbulb, Map as MapIcon,
  Medal, Menu, MessageCircle, Route, ScrollText, Search, Settings2, Shield, Swords, Target, Trophy, Users,
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
  { href: "/suggestions", label: "Suggestions", icon: Lightbulb },
  { href: "/leaderboards", label: "Leaderboards", icon: Trophy },
  { href: "/clips", label: "Clips", icon: Film },
  { href: "/rules", label: "Rules", icon: ScrollText },
  { href: "/community-settings", label: "Community Settings", icon: Settings2 },
];

function DiscordIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M19.54 5.34A16.3 16.3 0 0 0 15.44 4a11.2 11.2 0 0 0-.53 1.09 15.2 15.2 0 0 0-5.81 0A11.9 11.9 0 0 0 8.56 4c-1.44.25-2.82.7-4.1 1.34C1.87 9.15 1.17 12.86 1.52 16.5a16.6 16.6 0 0 0 5.03 2.54c.41-.56.77-1.15 1.08-1.78a10.7 10.7 0 0 1-1.7-.82l.42-.33a11.65 11.65 0 0 0 11.3 0l.43.33c-.55.32-1.12.6-1.7.82.31.63.67 1.22 1.08 1.78a16.5 16.5 0 0 0 5.02-2.54c.42-4.22-.72-7.9-2.94-11.16ZM8.5 14.27c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27 2.02 1.03 2 2.27c0 1.25-.89 2.27-2 2.27Zm7 0c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27 2.02 1.03 2 2.27c0 1.25-.88 2.27-2 2.27Z" />
    </svg>
  );
}

export async function SiteHeader({ user }: { user: SessionUser | null }) {
  const [hasApprovalAccess, isAdmin] = user ? await Promise.all([canAccessApproval(user), canAccessAdmin(user)]) : [false, false];
  const allLinks: NavLink[] = [
    ...links,
    ...(user ? [{ href: "/messages", label: "Friends", icon: MessageCircle }] : []),
    ...(hasApprovalAccess ? [{ href: "/approval", label: "Review", icon: ClipboardCheck, elevated: true }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield, elevated: true }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b14]/82 shadow-[0_10px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
      <div className="site-header-inner mx-auto flex max-w-[1700px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 lg:px-7 2xl:px-9">
        <Link href="/" prefetch className="group flex shrink-0 items-center gap-2.5 rounded-2xl px-1.5 py-1.5 sm:gap-3">
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-indigo-400 shadow-[0_8px_30px_rgba(124,143,240,0.25)] ring-1 ring-white/10 sm:h-11 sm:w-11"><img src="/favicon.ico" alt="Rhythians" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></span>
          <span className="site-brand-text hidden text-[15px] font-bold tracking-tight text-white sm:block sm:text-base">Rhythians</span>
          <span className="site-brand-meta hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted xl:inline">Beta</span>
          <span className="site-brand-meta hidden text-[10px] font-medium text-muted 2xl:inline">v{version}</span>
        </Link>

        <nav className="site-desktop-nav hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Primary navigation">
          {allLinks.map(({ href, label, icon: Icon, elevated }) => (
            <Link key={href} href={href} prefetch aria-label={label} className={`group/nav relative grid h-10 w-10 shrink-0 place-items-center overflow-visible rounded-xl border border-transparent transition duration-300 ease-out hover:border-white/10 hover:bg-white/[0.07] hover:text-white focus-visible:border-accent/40 focus-visible:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${elevated ? "text-accent" : "text-muted"}`}>
              <Icon className="shrink-0 transition duration-300 ease-out group-hover/nav:scale-110 group-hover/nav:text-accent group-focus-visible/nav:scale-110 group-focus-visible/nav:text-accent" size={17} strokeWidth={2} />
              <span className="pointer-events-none absolute left-[calc(100%+6px)] top-1/2 z-[70] origin-left -translate-y-1/2 translate-x-1 scale-95 whitespace-nowrap rounded-lg border border-white/10 bg-[#0c1120]/95 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out group-hover/nav:translate-x-0 group-hover/nav:scale-100 group-hover/nav:opacity-100 group-focus-visible/nav:translate-x-0 group-focus-visible/nav:scale-100 group-focus-visible/nav:opacity-100">{label}</span>
              {label === "Friends" && <UnreadIndicator />}
              <span className="pointer-events-none absolute inset-x-2 bottom-0 h-px origin-center scale-x-0 bg-gradient-to-r from-transparent via-accent to-transparent transition-transform duration-300 group-hover/nav:scale-x-100 group-focus-visible/nav:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="site-header-actions ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <details className="site-mobile-nav relative xl:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-muted hover:border-white/20 hover:bg-white/[0.07] hover:text-white [&::-webkit-details-marker]:hidden" aria-label="Open navigation menu"><Menu size={17} /><span className="site-mobile-menu-label hidden sm:inline">Menu</span><ChevronDown size={14} className="site-mobile-menu-label hidden sm:inline" /></summary>
            <nav className="site-mobile-menu-panel absolute right-0 mt-2 grid w-72 gap-1 rounded-2xl border border-white/10 bg-[#101629]/95 p-2 shadow-2xl backdrop-blur-2xl" aria-label="Mobile navigation">
              {allLinks.map(({ href, label, icon: Icon, elevated }) => <Link key={href} href={href} prefetch className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition hover:bg-white/[0.06] hover:text-white ${elevated ? "text-accent" : "text-muted"}`}><Icon size={17} className="shrink-0" /><span>{label}</span>{label === "Friends" && <UnreadIndicator />}</Link>)}
            </nav>
          </details>
          <a href="https://discord.gg/sNJJ3PEKx" target="_blank" rel="noopener noreferrer" aria-label="Join Rhythians Discord" title="Join Rhythians Discord" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-muted transition hover:border-[#5865F2]/50 hover:bg-[#5865F2]/15 hover:text-[#8b95ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]/50">
            <DiscordIcon />
          </a>
          <Link href="/search" prefetch aria-label="Search" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-muted hover:border-white/20 hover:bg-white/[0.07] hover:text-white sm:px-3.5"><Search size={16} /><span className="site-search-label hidden lg:inline">Search</span></Link>
          {user && <NotificationsBell />}
          {user ? <ProfileMenu user={user} /> : <Link href="/login" prefetch className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,143,240,0.2)] hover:bg-accent2 sm:px-4"><MessageCircle size={16} /><span className="site-login-label hidden sm:inline">Login</span></Link>}
        </div>
      </div>
    </header>
  );
}
