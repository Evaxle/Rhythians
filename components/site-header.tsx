import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
              R
            </div>
            Rhythians
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/" className="text-sm text-muted transition hover:text-white">Home</Link>
            <Link href="/knowledge" className="text-sm text-muted transition hover:text-white">Knowledge</Link>
            <Link href="/clips" className="text-sm text-muted transition hover:text-white">Clips</Link>
            <Link href="/rules" className="text-sm text-muted transition hover:text-white">Rules</Link>
            <Link href="/community" className="text-sm text-muted transition hover:text-white">Community</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-white">
            <Search size={16} /> Search
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2">
            <Discord size={16} /> Login
          </Link>
        </div>
      </div>
    </header>
  );
}
