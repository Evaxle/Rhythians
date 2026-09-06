"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarDays, Route, Map, Swords, Radio, BookOpen, Trophy, Scissors, Shield, ShieldCheck, Settings, Search, UserRound, UsersRound, MessageCircle, Bell, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_MOBILE_PREFERENCES, loadMobilePreferences, type MobilePreferences } from "@/lib/mobile-preferences";

const baseItems = [["/", "Home", Home], ["/daily", "Daily", CalendarDays], ["/path", "Path", Route], ["/maps", "Maps", Map], ["/categories?tab=challenge", "Challenge", Swords], ["/battles", "Battles", Swords], ["/online", "Online", Radio], ["/wiki", "Wiki", BookOpen], ["/leaderboards", "Ranks", Trophy], ["/clips", "Clips", Scissors], ["/rules", "Rules", Shield], ["/community-settings", "Community", UsersRound], ["/messages", "Friends", MessageCircle], ["/notifications", "Alerts", Bell], ["/settings", "Settings", Settings], ["/get-mobile", "Mobile", Smartphone]] as const;

type MobileShellProps = { children: React.ReactNode; canReview: boolean; canAdmin: boolean; user: { username: string; displayName: string | null; profileHandle: string; avatar: string | null; discordId: string | null } | null };

export function MobileShell({ children, canReview, canAdmin, user }: MobileShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = [...baseItems.slice(0, 13), ...(canReview ? [["/approval", "Review", ShieldCheck] as const] : []), ...(canAdmin ? [["/admin", "Admin", Shield] as const] : []), ...baseItems.slice(13)];
  const [prefs, setPrefs] = useState<MobilePreferences>(DEFAULT_MOBILE_PREFERENCES);

  useEffect(() => {
    loadMobilePreferences().then(setPrefs);
    const handlePreferences = (event: Event) => { const detail = (event as CustomEvent<MobilePreferences>).detail; if (detail) setPrefs(detail); };
    window.addEventListener("rhythians-mobile-preferences", handlePreferences);
    return () => window.removeEventListener("rhythians-mobile-preferences", handlePreferences);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = { htmlOverflow: html.style.overflow, bodyOverflow: body.style.overflow, bodyPosition: body.style.position, bodyWidth: body.style.width };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    return () => { html.style.overflow = previous.htmlOverflow; body.style.overflow = previous.bodyOverflow; body.style.position = previous.bodyPosition; body.style.width = previous.bodyWidth; };
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

  const navSide = prefs.navSide === "right" ? "right" : "left";
  return <div className={`mobile-app fixed inset-0 z-[60] h-[100dvh] w-screen overflow-hidden bg-[#060914] text-white mobile-nav-${navSide} ${prefs.compactNav ? "mobile-nav-compact" : ""} ${prefs.reduceMotion ? "mobile-reduced-motion" : ""}`}>
    <div className="mobile-app-topbar fixed left-0 right-0 top-0 z-50 flex h-[calc(56px+env(safe-area-inset-top))] items-end border-b border-white/10 bg-[#080c18]/94 pb-2.5 pt-[env(safe-area-inset-top)] shadow-xl backdrop-blur-2xl">
      <div className={`flex w-full min-w-0 items-center justify-between gap-2 px-3 ${navSide === "right" ? "pr-[calc(var(--mobile-nav-width)+12px)]" : "pl-[calc(var(--mobile-nav-width)+12px)]"}`}><div className="min-w-0"><p className="truncate text-sm font-bold text-white">Rhythians</p><p className="text-[10px] text-muted">Mobile</p></div><div className="flex min-w-0 items-center gap-1.5"><Link href="/mobile/search" aria-label="Search" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted"><Search size={16} /></Link>{user && prefs.showTopbarProfile ? <Link href={`/mobile/profile/${user.profileHandle}`} aria-label="Open profile" className="flex min-w-0 max-w-[44vw] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1">{user.avatar && user.discordId ? <img src={user.avatar.startsWith("http") ? user.avatar : `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=64`} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold">{user.username.slice(0, 1).toUpperCase()}</span>}<span className="min-w-0 truncate text-xs font-semibold text-white">{user.displayName ?? user.username}</span></Link> : <Link href="/mobile/settings" aria-label="Account" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted"><UserRound size={16} /></Link>}</div></div>
    </div>
    <aside className={`mobile-app-nav fixed bottom-0 top-[calc(56px+env(safe-area-inset-top))] z-40 flex w-[var(--mobile-nav-width)] min-w-0 flex-col border-white/10 bg-[#080c18]/96 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl backdrop-blur-2xl ${navSide === "right" ? "right-0 border-l" : "left-0 border-r"}`}><Link href="/mobile" aria-label="Rhythians home" className="mx-auto mb-2 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-accent to-indigo-400 shadow-lg ring-1 ring-white/10"><img src="/favicon.ico" alt="Rhythians" className="h-full w-full object-cover" /></Link><nav className="mobile-nav-scroll flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-1.5">{items.map(([href, label, Icon]) => { const path = href.split("?")[0]; const active = path === "/" ? pathname === "/mobile" : pathname === `/mobile${path}` || pathname.startsWith(`/mobile${path}/`); return <Link key={href} href={`/mobile${href === "/" ? "" : href}`} aria-label={label} className={`mobile-nav-item group flex w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-semibold transition ${active ? "bg-accent/20 text-white ring-1 ring-accent/30" : "text-muted hover:bg-white/[0.06] hover:text-white"}`}><Icon size={18} strokeWidth={active ? 2.4 : 1.9} /><span className="max-w-full truncate">{label}</span></Link>; })}</nav></aside>
    <section className={`mobile-app-main absolute bottom-0 top-[calc(56px+env(safe-area-inset-top))] min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain ${navSide === "right" ? "left-0 right-[var(--mobile-nav-width)]" : "left-[var(--mobile-nav-width)] right-0"}`}><main className="mobile-page mx-auto min-h-full w-full max-w-2xl min-w-0 overflow-x-hidden px-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-3 sm:px-4">{children}</main></section>
  </div>;
}
