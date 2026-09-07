"use client";

import { useEffect, useState } from "react";

type Props = {
  src?: string | null;
  username: string;
  displayName?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({ src, username, displayName, className = "h-12 w-12 rounded-full object-cover", fallbackClassName = "h-12 w-12 rounded-full bg-white/5 text-sm font-bold text-white" }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initial = (displayName?.trim() || username.trim() || "?").slice(0, 1).toUpperCase();
  if (!src || failed) return <span className={`inline-flex shrink-0 items-center justify-center ${fallbackClassName}`} aria-label={`${displayName ?? username} avatar fallback`}>{initial}</span>;
  return <img src={src} alt={displayName ?? username} className={className} onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
}
