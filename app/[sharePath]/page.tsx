"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function ShareRedirectPage() {
  const params = useParams<{ sharePath: string }>();

  useEffect(() => {
    const path = params.sharePath ?? "";
    if (!path.startsWith("share-")) {
      window.location.replace("/");
      return;
    }
    const userId = path.slice(6);
    if (!userId) {
      window.location.replace("/");
      return;
    }
    document.cookie = `rhythians_referrer=${encodeURIComponent(userId)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    window.location.replace("/register");
  }, [params.sharePath]);

  return <div className="mx-auto max-w-md rounded-3xl border border-border bg-surface/95 p-8 text-center shadow-glow"><p className="text-sm text-muted">Preparing your Rhythians invitation...</p></div>;
}
