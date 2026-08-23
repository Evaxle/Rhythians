"use client";

import { useEffect, useState } from "react";

export function UnreadIndicator() {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch("/api/messages/conversations", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        const hasUnread = (data.conversations ?? []).some((conversation: { unreadCount?: number }) => Number(conversation.unreadCount ?? 0) > 0);
        setUnread(hasUnread);
        document.title = hasUnread ? "● Rhythians" : "Rhythians";
      } catch {}
    }
    void refresh();
    const interval = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!unread) return null;
  return <span aria-label="Unread messages" className="ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_9px_rgba(253,224,71,0.9)]" />;
}
