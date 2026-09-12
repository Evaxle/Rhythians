"use client";

import { usePathname } from "next/navigation";
import { SspmImporter } from "@/components/maps/sspm-importer";

export function MapsClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/maps") return children;
  return <div className="space-y-5"><SspmImporter />{children}</div>;
}
