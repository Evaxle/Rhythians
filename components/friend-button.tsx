"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react";

export type FriendStatusType = "self" | "friends" | "outgoing_pending" | "incoming_pending" | "none";

export function FriendButton({ userId }: { userId: string }) {
  const [status, setStatus] = useState<FriendStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/friends/status?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const data = await response.json();
      setStatus(data.status);
    } catch {
      setStatus("none");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
  }, [loadStatus]);

  async function sendRequest() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send friend request.");
      setStatus(data.status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send friend request.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFriend() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/friends/${userId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove friend.");
      setStatus(data.status);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove friend.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </span>
    );
  }

  if (status === "self") return null;
  if (status === null) return null;

  if (status === "friends") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accent">
          <UserCheck size={16} /> Friends
        </span>
        <button
          type="button"
          onClick={removeFriend}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-50"
        >
          <UserMinus size={16} /> Unfriend
        </button>
      </span>
    );
  }

  if (status === "outgoing_pending") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-muted">
        <UserPlus size={16} /> Request sent
      </span>
    );
  }

  if (status === "incoming_pending") {
    return (
      <button
        type="button"
        onClick={sendRequest}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Accept friend request
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={sendRequest}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Add friend
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </span>
  );
}
