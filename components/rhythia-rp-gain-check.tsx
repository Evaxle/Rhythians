"use client";

import { useEffect, useState } from "react";

// Fires the 24-hour Rhythia RP gain check once on mount. The server gates the
// actual re-weight to once per day, so this is cheap on every other visit. If a
// gain was awarded it shows a small inline confirmation; otherwise it renders
// nothing (the notification bell also reports the gain).
export function RhythiaRpGainCheck() {
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    setDone(true);
    (async () => {
      try {
        const response = await fetch("/api/rhythia/rp-check", { method: "POST" });
        const body = await response.json();
        if (response.ok && body.awarded > 0) {
          setMessage(`+${body.awarded} RHP from your Rhythia RP`);
        }
      } catch {
        // Best-effort; the daily cron and next visit will retry.
      }
    })();
  }, [done]);

  if (!message) return null;
  return <p className="text-xs font-semibold text-accent">{message}</p>;
}
