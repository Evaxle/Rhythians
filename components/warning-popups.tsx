"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";

const DISMISSED_KEY = "rhythians_dismissed_warnings";

type WarningItem = {
  id: string;
  reason: string;
  createdAt: string;
  actor: string;
};

export function WarningPopups() {
  const [warnings, setWarnings] = useState<WarningItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/me/warnings", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        let dismissed: string[] = [];
        try {
          dismissed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
        } catch {}
        const dismissedSet = new Set(dismissed);
        setWarnings((data.warnings as WarningItem[]).filter((w) => !dismissedSet.has(w.id)));
      } catch {}
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = (id: string) => {
    setWarnings((current) => current.filter((w) => w.id !== id));
    try {
      const dismissed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
      dismissed.push(id);
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    } catch {}
  };

  if (warnings.length === 0) return null;

  return (
    <div className="warning-popups fixed bottom-4 right-4 z-[99990] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className="animate-modal-in rounded-2xl border border-amber-400/40 bg-surface/95 p-5 shadow-glow backdrop-blur"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 shrink-0 text-amber-300" />
              <p className="font-semibold text-white">You have a warning</p>
            </div>
            <button
              onClick={() => dismiss(warning.id)}
              aria-label="Dismiss"
              className="rounded-full p-1 text-muted transition hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">{warning.reason}</p>
          <p className="mt-2 text-xs text-muted/60">
            Issued by {warning.actor} on {new Date(warning.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}