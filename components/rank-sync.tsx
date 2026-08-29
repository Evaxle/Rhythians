"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = { initialRhp: number; initialUpdatedAt: string };

export function RankSync({ initialRhp, initialUpdatedAt }: Props) {
  const router = useRouter();
  const state = useRef({ rhp: initialRhp, updatedAt: initialUpdatedAt });

  useEffect(() => {
    state.current = { rhp: initialRhp, updatedAt: initialUpdatedAt };
  }, [initialRhp, initialUpdatedAt]);

  useEffect(() => {
    let active = true;
    let checking = false;

    const check = async () => {
      if (!active || checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch("/api/profile/rank-sync", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { rhp: number; updatedAt: string };
        if (data.rhp !== state.current.rhp || data.updatedAt !== state.current.updatedAt) {
          state.current = data;
          router.refresh();
        }
      } finally {
        checking = false;
      }
    };

    const interval = window.setInterval(() => void check(), 10000);
    const onVisible = () => void check();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
