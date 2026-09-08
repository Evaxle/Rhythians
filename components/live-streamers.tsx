"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Radio } from "lucide-react";
import { getRankInfo } from "@/lib/ranks";
import { RankIcon } from "@/components/rank-icon";
import { UserAvatar } from "@/components/user-avatar";

type LiveAccount = {
  platform: string;
  username: string;
  profileUrl: string;
  liveUrl: string | null;
  userId: string;
  rhythiansUsername: string;
  displayName: string | null;
  profileHandle: string;
  avatar: string | null;
  rhp: number;
  rhythiansGlobalRank: number;
  rhythiaUsername: string | null;
  rhythiaProfileUrl: string | null;
  rhythiaGlobalRank: number | null;
  playerRankName: string | null;
  playerRankColor: string | null;
};

export function LiveStreamers({ title = "Live streamers" }: { title?: string }) {
  const [live, setLive] = useState<LiveAccount[]>([]);

  useEffect(() => {
    let active = true;
    let loading = false;

    const load = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const response = await fetch("/api/streamers/live", { cache: "no-store" });
        const data = await response.json();
        if (active && response.ok) setLive(Array.isArray(data.live) ? data.live : []);
      } catch {
      } finally {
        loading = false;
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, LiveAccount[]>();
    for (const entry of live) {
      const current = groups.get(entry.userId) ?? [];
      current.push(entry);
      groups.set(entry.userId, current);
    }
    return [...groups.values()].slice(0, 5);
  }, [live]);

  if (!grouped.length) return null;

  return (
    <section className="rounded-[2rem] border border-rose-400/15 bg-[linear-gradient(145deg,rgba(244,63,94,.07),rgba(12,17,29,.95))] p-5 shadow-glow sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-rose-300">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-rose-400" />
        </span>
        <Radio size={15} />
        {title}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map((accounts) => {
          const user = accounts[0];
          const rhpRank = getRankInfo(Number(user.rhp) || 0);
          const destinations = accounts.map((account) => ({ platform: account.platform, url: account.liveUrl || account.profileUrl }));
          const displayName = user.displayName || user.rhythiansUsername;

          return (
            <article key={user.userId} className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <Link href={`/profile/${encodeURIComponent(user.profileHandle)}`} className="group relative shrink-0">
                  <span className="block h-16 w-16 overflow-hidden rounded-2xl border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,.22)]">
                    <UserAvatar src={user.avatar} username={user.rhythiansUsername} displayName={user.displayName} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
                  </span>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black text-white">LIVE</span>
                </Link>

                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${encodeURIComponent(user.profileHandle)}`} className="block truncate text-sm font-semibold text-white transition hover:text-accent">
                    {displayName}
                  </Link>
                  <p className="mt-0.5 truncate text-[11px] text-muted">@{user.profileHandle}</p>
                  {user.rhythiaUsername ? <p className="mt-1 truncate text-[11px] text-muted">Rhythia: {user.rhythiaUsername}</p> : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Rhythians global</p>
                  <p className="mt-1 text-sm font-bold text-white">#{Number(user.rhythiansGlobalRank).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Rhythia global</p>
                  <p className="mt-1 text-sm font-bold text-white">{user.rhythiaGlobalRank ? `#${user.rhythiaGlobalRank.toLocaleString()}` : "Unranked"}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background/45 px-3 py-2">
                <RankIcon rank={rhpRank} size={28} />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Rhythians classification</p>
                  <p className="truncate text-xs font-semibold" style={{ color: user.playerRankColor || rhpRank.color }}>
                    {user.playerRankName || (rhpRank.isExpert ? "Expert" : `${rhpRank.name} ${rhpRank.tier}`)}
                  </p>
                </div>
                <span className="ml-auto text-[10px] font-semibold text-muted">{Number(user.rhp).toLocaleString()} RHP</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {destinations.map((item) => (
                  <a key={item.platform} href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1.5 text-[10px] font-semibold capitalize text-rose-200 transition hover:bg-rose-500/25 hover:text-white">
                    {item.platform} <ExternalLink size={10} />
                  </a>
                ))}
                {user.rhythiaProfileUrl ? (
                  <a href={user.rhythiaProfileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-muted transition hover:text-white">
                    Rhythia profile <ExternalLink size={10} />
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
