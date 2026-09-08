import Link from "next/link";
import { Settings2, Grid3X3, Trophy, Swords, Zap, ArrowRight, Medal, Map, Radio } from "lucide-react";

const guides = [
  { href: "/wiki/ranking", title: "Ranking", text: "RHP, RPL, RPS and RPV, rank tiers, map rating ranges, and progression. Expert is a single final rank without numbered tiers.", icon: Trophy },
  { href: "/wiki/challenge", title: "Challenges", text: "Challenge levels, skill categories, map progression, and how challenge completions work.", icon: Swords },
  { href: "/wiki/battles", title: "Battles", text: "Ranked and casual battles, RBP seasons, matchmaking, map selection, score checking, and seasonal placement.", icon: Swords },
  { href: "/tournaments", title: "Tournaments", text: "Lower and Higher splits, bracket sizes, signups, live brackets, match timing, tournament maps, and finals.", icon: Medal },
  { href: "/maps", title: "Ranked maps", text: "Browse maps by your separate Lock, Spin, and VR eligibility. Each map shows whether it can currently award RPL, RPS, or RPV.", icon: Map },
  { href: "/wiki/settings", title: "Settings", text: "Sensitivity, DPI, approach rate, spawn distance, parallax, spin mode, note meshes, and other game settings.", icon: Settings2 },
  { href: "/wiki/vibro", title: "Vibro", text: "Linear, Spin, Mouse Swiveling, and Cheesing explanations with demonstrations.", icon: Zap },
  { href: "/wiki/patterns", title: "Patterns", text: "Streams, jumps, slides, stacks, spirals, anchors, off-grid paths, bursts, and other common patterns.", icon: Grid3X3 },
];

export default function WikiPage() {
  return <div className="ui-page space-y-7"><section className="rounded-[2rem] border border-white/10 bg-surface/95 p-7 shadow-glow sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Rhythians Wiki</p><h1 className="mt-3 text-3xl font-semibold text-white">How Rhythians works</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-muted">A practical guide to ranking, maps, challenges, battles, tournaments, and the game systems connected to Rhythians.</p></section>
  <section className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[0.055] p-6 shadow-glow"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-300"><Radio size={14} /> Recent platform updates</p><p className="mt-3 text-sm leading-7 text-white/85">Profiles can now connect TikTok and Twitch through OAuth. TikTok users can choose up to three authorized videos for their Rhythians profile. Battle Rank uses seasonal RBP placement, tournament brackets support larger player caps, and the Maps page separates RPL, RPS, and RPV eligibility so players can see which maps count for each mode.</p></section>
  <div className="grid gap-4 md:grid-cols-2">{guides.map(({ href, title, text, icon: Icon }) => <Link key={href} href={href} className="group rounded-[1.75rem] border border-white/10 bg-surface/90 p-6 shadow-glow transition hover:-translate-y-0.5 hover:border-accent/35"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent"><Icon size={22} /></div><h2 className="mt-4 text-xl font-semibold text-white group-hover:text-accent">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">Open <ArrowRight size={15} /></span></Link>)}</div></div>;
}
