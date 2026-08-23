"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

function getRemaining(endsAt: string) {
  return Math.max(0, new Date(endsAt).getTime() - Date.now());
}

export function SeasonCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState(() => getRemaining(endsAt));

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemaining(endsAt)), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const values = useMemo(() => {
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  }, [remaining]);

  return <div className="mx-auto mt-5 max-w-md rounded-3xl border border-border bg-background/65 p-4 shadow-glow backdrop-blur"><div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted"><Clock3 size={14} /> Season ends in</div><div className="mt-3 grid grid-cols-4 gap-2">{[[values.days, "Days"], [values.hours, "Hours"], [values.minutes, "Minutes"], [values.seconds, "Seconds"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-border bg-white/[0.03] px-2 py-3"><p className="text-xl font-bold text-white tabular-nums">{String(value).padStart(label === "Days" ? 1 : 2, "0")}</p><p className="mt-1 text-[9px] uppercase tracking-[0.15em] text-muted">{label}</p></div>)}</div></div>;
}
