"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface UserWithTags {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  inGuild: boolean;
  discordRoles: string[];
  userTags: Array<{ tag: Tag }>;
}

export function DiscordSyncButton({
  onSynced,
}: {
  onSynced?: (user: UserWithTags) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/discord/sync", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? "Sync failed");
      }
      setMessage({
        type: "success",
        text: body.inGuild
          ? `Synced ${body.tagsApplied} tag${body.tagsApplied === 1 ? "" : "s"}${
              body.tagsRemoved > 0 ? ` and removed ${body.tagsRemoved}` : ""
            }.`
          : "You're not in the Discord server, so no roles were synced.",
      });
      onSynced?.(body.user);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to sync roles",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Discord roles"}
      </button>
      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-accent" : "text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
