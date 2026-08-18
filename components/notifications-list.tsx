"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, CheckCheck } from "lucide-react";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsList({ initial }: { initial: NotificationItem[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [marking, setMarking] = useState(false);

  const markAllRead = async () => {
    setMarking(true);
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) return;
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    } finally {
      setMarking(false);
    }
  };

  const markRead = async (id: string) => {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface/95 p-12 text-sm text-muted shadow-glow">
        <BellOff className="h-8 w-8 text-muted" />
        <p>No notifications yet. You&apos;ll see updates here when a clip you submitted is approved or rejected.</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2 text-sm text-white transition hover:border-accent/40 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            {marking ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => {
          const content = (
            <>
              <div className="flex items-start justify-between gap-4">
                <p className="font-semibold text-white">{notification.title}</p>
                <span className="shrink-0 text-xs text-muted">{timeAgo(notification.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">{notification.message}</p>
            </>
          );

          const wrapper = (children: React.ReactNode) =>
            notification.url ? (
              <Link
                href={notification.url}
                onClick={() => markRead(notification.id)}
                className="block"
              >
                {children}
              </Link>
            ) : (
              <div onClick={() => markRead(notification.id)}>{children}</div>
            );

          return (
            <div
              key={notification.id}
              className={`rounded-3xl border bg-surface/95 p-5 transition hover:border-accent/30 ${
                notification.read ? "border-border" : "border-accent/40 bg-accent/5"
              }`}
            >
              {wrapper(content)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
