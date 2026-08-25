"use client";

import { X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import type { RankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";

export function HomePathNotice({ regularRank, pathRank }: { regularRank: RankInfo; pathRank: RankInfo | null }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <section className="relative rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 pr-14 shadow-glow">
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss path notice" className="absolute right-4 top-4 rounded-full p-2 text-amber-200 transition hover:bg-amber-400/10 hover:text-white"><X size={18} /></button>
      <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Seasonal Path</p>
      <h2 className="mt-2 text-lg font-semibold text-white">Your seasonal path is below your regular rank</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm leading-6 text-amber-100/80">
        <span className="inline-flex items-center gap-2"><RankIcon rank={regularRank} size={34} />Your regular rank is {regularRank.isExpert ? "Expert" : `${regularRank.name} ${regularRank.tier}`}</span>
        <span>but your seasonal path is only</span>
        {pathRank ? <span className="inline-flex items-center gap-2"><RankIcon rank={pathRank} size={34} />{pathRank.isExpert ? "Expert" : `${pathRank.name} ${pathRank.tier}`}</span> : <span>Unranked</span>}
      </div>
      <p className="mt-2 text-sm leading-6 text-amber-100/80">Complete the path maps until you reach your current rank.</p>
      <Link href="/path" className="mt-4 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20">Continue your path</Link>
    </section>
  );
}
