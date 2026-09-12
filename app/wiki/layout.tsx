import { NavLink } from "@/components/nav-link";
import { BookOpen, Settings2, Grid3X3, Trophy, Swords } from "lucide-react";

const navItems = [
  { href: "/wiki", label: "Overview", icon: BookOpen },
  { href: "/wiki/battles", label: "Battle guide", icon: Swords },
  { href: "/wiki/vibro", label: "Vibro techniques", icon: Grid3X3 },
  { href: "/wiki/ranking", label: "About Ranking", icon: Trophy },
  { href: "/wiki/challenge", label: "About Challenge", icon: Swords },
  { href: "/wiki/settings", label: "Settings Guide", icon: Settings2 },
  { href: "/wiki/patterns", label: "Patterns Wiki", icon: Grid3X3 },
];

export default function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <div className="space-y-6">
          <div>
            <p className="ui-eyebrow">Wiki</p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Rhythia guides
            </h2>
          </div>
          <nav className="space-y-2 text-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-muted transition hover:bg-white/5 hover:text-white"
                >
                  <Icon size={18} className="shrink-0 text-accent" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
