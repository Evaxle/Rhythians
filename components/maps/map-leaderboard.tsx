"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MapLeaderboard({ mapId }: { mapId: string; currentUserId?: string | null; onClose?: () => void }) {
  const router = useRouter();

  useEffect(() => {
    router.push(`/maps/${mapId}`);
  }, [mapId, router]);

  return <p className="mt-3 text-xs text-muted">Opening map leaderboard...</p>;
}
