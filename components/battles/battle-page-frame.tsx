"use client";

import { motion } from "motion/react";

export function BattlePageFrame({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .35, ease: [0.16,1,0.3,1] }} className="relative space-y-6"><motion.div aria-hidden className="pointer-events-none absolute -left-24 -top-20 -z-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl" animate={{ scale: [1, 1.14, 1], opacity: [.45, .8, .45] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} /><motion.div aria-hidden className="pointer-events-none absolute -right-24 top-40 -z-10 h-72 w-72 rounded-full bg-emerald-400/[0.06] blur-3xl" animate={{ y: [0, 24, 0], opacity: [.4, .75, .4] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />{children}</motion.div>;
}
