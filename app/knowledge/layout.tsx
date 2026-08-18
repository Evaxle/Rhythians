import Link from "next/link";
import { Settings2, Grid3X3 } from "lucide-react";

const navItems = [
  { href: "/knowledge/settings", label: "Settings Guide", icon: Settings2 },
  { href: "/knowledge/patterns", label: "Patterns Wiki", icon: Grid3X3 },
];

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-128px)] grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="h-fit rounded-3xl border border-border bg-surface/95 p-6 shadow-glow lg:sticky lg:top-8">
        <div className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">Knowledge</p>
            <h2 className="mt-3 text-xl font-semibold text-white">Rhythia guides</h2>
          </div>
          <nav className="space-y-2 text-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <Icon size={18} className="shrink-0 text-accent" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
