import "./globals.css";
import "./ui-overhaul.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { SiteHeader } from "@/components/site-header";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { CursorFX } from "@/components/cursor-fx";
import { WarningPopups } from "@/components/warning-popups";
import { AccountSecurityNotice } from "@/components/account-security-notice";
import { RankSync } from "@/components/rank-sync";
import { MobileRedirect } from "@/components/mobile-redirect";
import { AnimatedRouteFrame } from "@/components/animated-route-frame";
import { getSessionUser } from "@/lib/auth";
import { getRankInfo } from "@/lib/ranks";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = { themeColor: "#0b0f19" };
export const metadata: Metadata = { title: "Rhythians Beta", description: "Discord community platform for knowledge, clips, and community media.", metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"), icons: { icon: "/favicon.ico" }, openGraph: { title: "Rhythians Beta", description: "A community platform for curated knowledge, clips, and Discord integration.", type: "website" }, robots: { index: true, follow: true } };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const rankColor = user ? getRankInfo(user.rhp).color : "#7c8ff0";
  return <html lang="en" suppressHydrationWarning><head><title>Rhythians Beta</title><meta name="application-name" content="Rhythians Beta" /></head><body className={`${inter.className} bg-background text-white`}><Script id="vercel-analytics-init">{`window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };`}</Script><Script id="vercel-speed-insights-init">{`window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };`}</Script><Script src="/_vercel/insights/script.js" strategy="afterInteractive" /><Script src="/_vercel/speed-insights/script.js" strategy="afterInteractive" /><div className="min-h-screen text-white" style={{ background: `radial-gradient(circle at 50% -10%, ${rankColor}18, transparent 36%), radial-gradient(circle at 0% 35%, ${rankColor}0b, transparent 28%), linear-gradient(180deg, ${rankColor}06 0%, transparent 45%), var(--page-bg)` }}><MobileRedirect /><AccountSecurityNotice />{user && <RankSync initialRhp={user.rhp} initialUpdatedAt={user.updatedAt.toISOString()} />}<SiteHeader user={user} /><main className="mx-auto w-full max-w-[1600px] px-4 pb-14 pt-6 sm:px-6 lg:px-8"><AnimatedRouteFrame>{children}</AnimatedRouteFrame></main><footer className="border-t border-border bg-surface/80 px-4 py-6 text-sm text-muted sm:px-6"><div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-white">Rhythians</p><p>Powered by Discord, Supabase, and Next.js.</p></div><div className="flex flex-wrap items-center gap-3 text-sm text-muted"><a href="/" className="hover:text-white">Home</a><a href="/wiki" className="hover:text-white">Wiki</a><a href="/clips" className="hover:text-white">Clips</a><a href="/rules" className="hover:text-white">Rules</a><a href="/community" className="hover:text-white">Community</a><a href="/profile/lc727-0" className="rounded-full border border-border bg-white/5 px-3 py-1.5 font-medium transition hover:border-accent/40 hover:bg-white/10 hover:text-white">Daily maps and Rank icons made by lc727</a></div></div></footer><TailwindIndicator /><CursorFX /><WarningPopups /></div></body></html>;
}
