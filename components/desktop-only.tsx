"use client";

import { usePathname } from "next/navigation";

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/mobile")) return null;
  return <>{children}</>;
}
