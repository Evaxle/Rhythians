"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarDays, Route, Map, Swords, Radio, BookOpen, Trophy, Scissors, Shield, ShieldCheck, Settings, Search, UserRound, UsersRound, MessageCircle, Bell, Menu, X, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_MOBILE_PREFERENCES, loadMobilePreferences, type MobilePreferences } from "@/lib/mobile-preferences";

const baseItems = [
  ["/", "Home", Home], ["/daily", "Daily", CalendarDays], ["/path", "Path", Route], ["/maps", "Maps", Map], ["/battles", "Battles", Swords], ["/online", "Online", Radio], ["/wiki", "Wiki", BookOpen], ["/leaderboards", "Ranks", Trophy], ["/clips", "Clips", Scissors], ["/rules", "Rules", Shield], ["/community-settings", "Community", UsersRound], ["/messages", "Friends", MessageCircle], ["/notifications", "Alerts", Bell], ["/settings", "Settings", Settings], ["/get-mobile", "Mobile", Smartphone],
] as const;

type MobileShellProps = {
  children: React.ReactNode;
  canReview: boolean;
  canAdmin: boolean;
  user: { username: string; displayName: string | null; profileHandle: string; avatar: string | null; discordId: string | null } | null;
};

export function MobileShell({ children, canReview, canAdmin, user }: MobileShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = [
    ...baseItems.slice(0, 13),
    ...(canReview ? [["/approval", "Review", ShieldCheck] as const] : []),
    ...(canAdmin ? [["/admin", "Admin", Shield] as const] : []),
    ...baseItems.slice(13),
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [prefs, setPrefs] = useState<MobilePreferences>(DEFAULT_MOBILE_PREFERENCES);

  useEffect(() => {
    loadMobilePreferences().then(setPrefs);
    const handlePreferences = (event: Event) => {
      const detail = (event as CustomEvent<MobilePreferences>).detail;
      if (detail) setPrefs(detail);
    };
    window.addEventListener("rhythians-mobile-preferences", handlePreferences);
    return () => window.removeEventListener("rhythians-mobile-preferences", handlePreferences);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/mobile/" }).catch(() => undefined);
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/mobile") || url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) return;
      event.preventDefault();
      router.push(`/mobile${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className={`mobile-app fixed inset-0 z-[60] h-[100dvh] w-screen overflow-hidden bg-[#060914] text-white ${prefs.navSide === "right" ? "mobile-nav-right" : "mobile-nav-left"} ${prefs.compactNav ? "mobile-nav-compact" : ""} ${prefs.reduceMotion ? "mobile-reduced-motion" : ""}`}> z-[60] h-[100dvh] w-screen overflow-hidden bg-[#060914] text-white">
      <aside className={`mobile-app-nav fixed inset-y-0 z-40 flex h-[100dvh] w-[72px] shrink-0 flex-col border-white/10 bg-[#080c18]/96 py-3 shadow-2xl backdrop-blur-2xl sm:w-[82px] ${prefs.navSide === "right" ? "right-0 border-l" : "left-0 border-r"}`}>
        <Link href="/mobile" aria-label="Rhythians home" className="mx-auto mb-3 grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-indigo-400 shadow-lg ring-1 ring-white/10"><img src="/favicon.ico" alt="Rhythians" className="h-full w-full object-cover" /></Link>
        <nav className="mobile-nav-scroll flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5">
          {items.map(([href, label, Icon]) => {
            const active = href === "/" ? pathname === "/mobile" : pathname === `/mobile${href}` || pathname.startsWith(`/mobile${href}/`);
            return <Link key={href} href={`/mobile${href === "/" ? "" : href}`} aria-label={label} className={`mobile-nav-item group flex w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-semibold transition ${active ? "bg-accent/20 text-white ring-1 ring-accent/30" : "text-muted hover:bg-white/[0.06] hover:text-white"}`}><Icon size={18} strokeWidth={active ? 2.4 : 1.9} /><span className="max-w-full truncate">{label}</span></Link>;
          })}
        </nav>
        <div className="mt-2 flex flex-col items-center gap-1 border-t border-white/10 pt-2">
          <Link href="/mobile/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-white"><Search size={18} /></Link>
          <Link href="/mobile/settings" aria-label="Account" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-white"><UserRound size={18} /></Link>
          <button type="button" aria-label="Open mobile navigation" onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-white sm:hidden"><Menu size={18} /></button>
        </div>
      </aside>
      <section className={`mobile-app-main absolute inset-y-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain ${prefs.navSide === "right" ? "left-0 right-[72px] sm:right-[82px]" : "left-[72px] right-0 sm:left-[82px]"}`}>
        <div className={`mobile-app-topbar fixed top-0 z-30 flex min-h-14 h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#080c18]/90 px-3 backdrop-blur-xl sm:px-4 ${prefs.navSide === "right" ? "left-0 right-[72px] sm:right-[82px]" : "left-[72px] right-0 sm:left-[82px]"}`}>
          <div className="min-w-0 pl-1"><p className="truncate text-sm font-bold text-white">Rhythians</p><p className="text-[10px] text-muted">Mobile</p></div>
          <div className="flex min-w-0 items-center gap-1.5">
            <Link href="/mobile/search" aria-label="Search" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted"><Search size={16} /></Link>
            {user && prefs.showTopbarProfile ? (
              <Link href={`/mobile/profile/${user.profileHandle}`} aria-label="Open profile" className="flex min-w-0 max-w-[48vw] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1">
                {user.avatar && user.discordId ? <img src={user.avatar.startsWith("http") ? user.avatar : `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=64`} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold">{user.username.slice(0, 1).toUpperCase()}</span>}
                <span className="min-w-0 truncate text-xs font-semibold text-white">{user.displayName ?? user.username}</span>
              </Link>
            ) : <Link href="/mobile/settings" aria-label="Account" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted"><UserRound size={16} /></Link>}
          </div>
        </div>
        <main className="mobile-page mx-auto w-full max-w-2xl min-w-0 overflow-x-hidden px-3 pb-8 pt-[68px] sm:px-4 sm:pt-[72px]">{children}</main>
      </section>
      {menuOpen && <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm sm:hidden" onClick={() => setMenuOpen(false)}><div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-white/10 bg-[#080c18] p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between pb-3"><span className="font-bold">Rhythians</span><button type="button" onClick={() => setMenuOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06]"><X size={17} /></button></div>{items.map(([href, label, Icon]) => <Link key={href} href={`/mobile${href === "/" ? "" : href}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted hover:bg-white/[0.06] hover:text-white"><Icon size={18} />{label}</Link>)}</div></div>}
    </div>
  );
}
