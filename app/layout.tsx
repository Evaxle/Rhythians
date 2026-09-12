import "./globals.css";
import "./mobile.css";
import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { CursorFX } from "@/components/cursor-fx";
import { WarningPopups } from "@/components/warning-popups";
import { AccountSecurityNotice } from "@/components/account-security-notice";
import { RankSync } from "@/components/rank-sync";
import { PwaRegistration } from "@/components/pwa-registration";
import { BandwidthProtectionNotice } from "@/components/bandwidth-protection-notice";
import { getSessionUser } from "@/lib/auth";
import { getRankInfo } from "@/lib/ranks";

const inter = Inter({ subsets: ["latin"] });
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0f19",
};
export const metadata: Metadata = {
  title: "Rhythians Beta",
  description:
    "Discord community platform for knowledge, clips, and community media.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rhythians",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/favicon.ico", apple: "/favicon.ico" },
  openGraph: {
    title: "Rhythians Beta",
    description:
      "A community platform for curated knowledge, clips, and Discord integration.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const rankColor = user ? getRankInfo(user.rhp).color : "#7c8ff0";
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Rhythians Beta" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} bg-background text-white`}>
        <Script
          id="mobile-device-detection"
          strategy="beforeInteractive"
        >{`try{var ua=navigator.userAgent||\"\";var mobile=/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)||(navigator.maxTouchPoints>1&&Math.min(screen.width,screen.height)<=900);if(mobile)document.documentElement.classList.add(\"mobile-device\");}catch(e){}`}</Script>
        <Script id="vercel-analytics-init">{`window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };`}</Script>
        <Script id="vercel-speed-insights-init">{`window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };`}</Script>
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
        <Script
          src="/_vercel/speed-insights/script.js"
          strategy="afterInteractive"
        />
        <PwaRegistration />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div
          className="site-shell"
          style={{ "--rank-accent": rankColor } as CSSProperties}
        >
          <div className="ambient-background" aria-hidden="true" />
          <AccountSecurityNotice />
          <BandwidthProtectionNotice />
          {user && (
            <RankSync
              initialRhp={user.rhp}
              initialUpdatedAt={user.updatedAt.toISOString()}
            />
          )}
          <SiteHeader user={user} />
          <main id="main-content" tabIndex={-1} className="site-main">
            {children}
          </main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <div>
                <Link href="/" className="font-semibold text-white">
                  Rhythians
                </Link>
                <p className="mt-1 text-sm text-muted">
                  The Rhythia community.
                </p>
              </div>
              <nav
                aria-label="Footer navigation"
                className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted"
              >
                <Link href="/mobile">Mobile app</Link>
                <Link href="/rules">Rules</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/profile/lc727-0">Maps & rank icons by lc727</Link>
              </nav>
            </div>
          </footer>
          <TailwindIndicator />
          <CursorFX />
          <WarningPopups />
        </div>
      </body>
    </html>
  );
}
