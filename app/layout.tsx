import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { SiteHeader } from "@/components/site-header";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { CursorFX } from "@/components/cursor-fx";
import { WarningPopups } from "@/components/warning-popups";
import { TermsGate } from "@/components/terms-gate";
import { getSessionUser } from "@/lib/auth";
import { hasAcceptedCurrentTerms } from "@/lib/terms";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#0b0f19",
};

export const metadata: Metadata = {
  title: "Rhythians Beta",
  description: "Discord community platform for knowledge, clips, and community media.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Rhythians Beta Community",
    description: "A community platform for curated knowledge, clips, and Discord integration.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const termsAccepted = user ? await hasAcceptedCurrentTerms(user.id) : true;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-white`}>
        <Script id="vercel-analytics-init">{`window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };`}</Script>
        <Script id="vercel-speed-insights-init">{`window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };`}</Script>
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
        <Script src="/_vercel/speed-insights/script.js" strategy="afterInteractive" />
        <div className="min-h-screen bg-background text-white">
          <SiteHeader />
          <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="border-t border-border bg-surface/80 px-4 py-6 text-sm text-muted sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">Rhythians</p>
                  <p>Powered by Discord, Supabase, and Next.js.</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted">
                  <a href="/" className="hover:text-white">Home</a>
                  <a href="/wiki" className="hover:text-white">Wiki</a>
                  <a href="/clips" className="hover:text-white">Clips</a>
                  <a href="/rules" className="hover:text-white">Rules</a>
                  <a href="/community" className="hover:text-white">Community</a>
                  <a href="/terms" className="font-medium text-white hover:underline">Terms of Service</a>
                </div>
              </div>
              <div className="border-t border-border pt-4 text-xs leading-5 text-muted/80">
                <p>© 2026 Rhythians. All rights reserved. Unless otherwise stated, the original Rhythians website, software, interface, branding, and original content are works of the Rhythians project.</p>
                <p className="mt-1">Rhythia maps, rankings, map metadata, and other Rhythia-originated data are third-party material associated with Rhythia and their respective creators or rights holders. Rhythians does not claim ownership of that material. <a href="https://www.rhythia.com" target="_blank" rel="noreferrer" className="text-white hover:underline">Visit Rhythia</a>.</p>
              </div>
            </div>
          </footer>
          <TailwindIndicator />
          <CursorFX />
          <WarningPopups />
          <TermsGate required={!termsAccepted} />
        </div>
      </body>
    </html>
  );
}
