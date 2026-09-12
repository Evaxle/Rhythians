"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Film,
  Home,
  Lightbulb,
  Map,
  Menu,
  Medal,
  MessageCircle,
  Route,
  ScrollText,
  Settings2,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { UnreadIndicator } from "@/components/messages/unread-indicator";

const primary = [
  { href: "/", label: "Home", icon: Home },
  { href: "/maps", label: "Maps", icon: Map },
  { href: "/daily", label: "Daily", icon: CalendarDays },
  { href: "/leaderboards", label: "Ranks", icon: Trophy },
  { href: "/battles", label: "Battles", icon: Swords },
];
const groups = [
  {
    label: "Play",
    links: [
      { href: "/path", label: "Seasonal path", icon: Route },
      { href: "/categories?tab=challenge", label: "Challenges", icon: Target },
      { href: "/tournaments", label: "Tournaments", icon: Medal },
    ],
  },
  {
    label: "Community",
    links: [
      { href: "/clips", label: "Clips", icon: Film },
      { href: "/online", label: "Online players", icon: Users },
      { href: "/suggestions", label: "Suggestions", icon: Lightbulb },
      {
        href: "/community-settings",
        label: "Player settings",
        icon: Settings2,
      },
    ],
  },
  {
    label: "Learn",
    links: [
      { href: "/wiki", label: "Wiki & guides", icon: BookOpen },
      { href: "/rules", label: "Rules", icon: ScrollText },
    ],
  },
];

export function SiteNavigation({
  signedIn,
  approval,
  admin,
}: {
  signedIn: boolean;
  approval: boolean;
  admin: boolean;
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpenPath(null);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  const account = [
    ...(signedIn
      ? [
          {
            href: "/messages",
            label: "Friends & messages",
            icon: MessageCircle,
          },
        ]
      : []),
    ...(approval
      ? [
          {
            href: "/approval",
            label: "Review submissions",
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(admin
      ? [{ href: "/admin", label: "Administration", icon: Shield }]
      : []),
  ];
  return (
    <div ref={container} className="site-navigation">
      <nav className="site-primary" aria-label="Primary navigation">
        {primary.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} className="nav-item">
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button
        ref={trigger}
        type="button"
        className="nav-item nav-toggle"
        aria-expanded={open}
        aria-controls="site-navigation-panel"
        aria-label={open ? "Close navigation" : "More navigation"}
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
        <span>Explore</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <nav
          id="site-navigation-panel"
          className="nav-panel animate-rise-in"
          aria-label="Explore Rhythians"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpenPath(null);
          }}
          onBlur={(event) => {
            if (
              event.relatedTarget &&
              !container.current?.contains(event.relatedTarget as Node)
            )
              setOpenPath(null);
          }}
        >
          <div className="nav-mobile-primary">
            {primary.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} className="nav-item">
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </div>
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <p>{group.label}</p>
              {group.links.map(({ href, label, icon: Icon }) => (
                <NavLink key={href} href={href} className="nav-item">
                  <Icon size={17} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
          {account.length > 0 && (
            <div className="nav-account">
              {account.map(({ href, label, icon: Icon }) => (
                <NavLink key={href} href={href} className="nav-item relative">
                  <Icon size={17} />
                  {label}
                  {href === "/messages" && <UnreadIndicator />}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
