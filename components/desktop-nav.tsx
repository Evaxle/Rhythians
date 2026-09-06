"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, CalendarDays, Route, Map, Swords, Radio, BookOpen, Trophy, Scissors, Shield, UsersRound, MessageCircle, ShieldCheck, Settings2 } from "lucide-react";

const icons = { Home, Daily: CalendarDays, Path: Route, Maps: Map, Challenge: Swords, Battles: Swords, Online: Radio, Wiki: BookOpen, Leaderboards: Trophy, Clips: Scissors, Rules: Shield, "Community Settings": UsersRound, Friends: MessageCircle, Review: ShieldCheck, Admin: Settings2 };

type NavItem = readonly [string, string];

export function DesktopNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">{items.map(([href, label]) => {
    const Icon = icons[label as keyof typeof icons] ?? Home;
    const path = href.split("?")[0];
    const active = path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
    return <Link key={href} href={href} prefetch aria-label={label} className="group relative flex h-10 items-center justify-center overflow-visible rounded-xl border border-transparent px-2 text-muted transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white">
      {active && <motion.span layoutId="desktop-nav-active" className="absolute inset-0 -z-10 rounded-xl border border-accent/25 bg-accent/10" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
      <motion.span whileHover={{ y: -2, scale: 1.08 }} transition={{ type: "spring", stiffness: 500, damping: 28 }} className={active ? "text-accent" : ""}><Icon size={17} /></motion.span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg border border-white/10 bg-[#101629]/98 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-2xl backdrop-blur-xl transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">{label}</span>
    </Link>;
  })}</nav>;
}
