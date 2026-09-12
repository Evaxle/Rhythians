"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export function NavLink({
  href,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const target = String(href).split("?")[0];
  const exact = ["/", "/admin", "/approval", "/wiki"].includes(target);
  const active = exact
    ? pathname === target
    : pathname === target || pathname.startsWith(`${target}/`);
  return (
    <Link
      {...props}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? "is-active" : ""}`}
    >
      {children}
    </Link>
  );
}
