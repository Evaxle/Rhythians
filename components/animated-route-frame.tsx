"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

export function AnimatedRouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/mobile")) return <>{children}</>;
  return <AnimatePresence mode="wait" initial={false}><motion.div key={pathname} initial={{ opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>{children}</motion.div></AnimatePresence>;
}
