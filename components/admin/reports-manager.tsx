"use client";

import { useMemo, useState } from "react";
import { Flag, RefreshCw, Search } from "lucide-react";
import { fairRatingFromStars } from "@/lib/ranks";

interface ReportItem {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; username: string; discriminator: string; profileHandle: string };
  targetUser: { id: string; username: string; discriminator: string; profileHandle: string; isSuspended: boolean } | null;
  targetClip: { id: string; title: string; status: string; uploader?: { id: string; username: string } | null } | null;
  targetMap: { id: string; title: string; rating: number | null; status: string } | null;
}

interface BannedUser {
  id: string;
  username: string;
  discriminator: string;
  profileHandle: string;
  avatar: string | null;
  bannedAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

type Tab = "user" | "clip" | "map" | "banned";

export function ReportsManager({
  initialReports,
  initialBannedUsers,
}: {
  initialReports: ReportItem[];
  initialBannedUsers: BannedUser[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [bannedUsers, setBannedUsers] = useState(initialBannedUsers);
  const [tab, setTab] = useState<Tab>("user");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [warnFor, setWarnFor] = useState<string | null>(null);
  const [warnMessage, setWarnMessage] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");

  async function reload() {
    const response = await fetch("/api/admin/reports", { cache: "no-store" });
    const data = await response.json();
    setReports(data.reports);
    setBannedUsers(data.bannedUsers);
  }

  async function runAction(id: string, action: string, message?: string) {
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      setWarnFor(null);
      setWarnMessage("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId("");
    }
  }

  async function unbanUser(id: string) {
    setError("");
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/users/${id}/unban`, { method: "PATCH" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not unban.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unban.");
    } finally {
      setBusyId("");
    }
  }

  async function refreshDaily(dailyMapId?: string) {
    setError("");
    setBusyId("refresh");
    try {
      const response = await fetch("/api/admin/daily/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyMapId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not refresh the daily map.");
      setRefreshMessage(`Daily map refreshed to: ${data.map.title} (${fairRatingFromStars(data.map.starRating).toFixed(2)} rating).`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh the daily map.");
    } finally {
      setBusyId("");
    }
  }

  const normalizedQuery = query.trim().toLowerCase();

  const filteredReports = useMemo(() => {
    const byType = reports.filter((report) => {
      if (tab === "user") return report.targetType === "user";
      if (tab === "clip") return report.targetType === "clip";
      if (tab === "map") return report.targetType === "daily_map" || report.targetType === "challenge_map";
      return false;
    });
    if (!normalizedQuery) return byType;
    return byType.filter((report) => {
      const haystack = [
        report.reporter.username,
        report.targetUser?.username,
        report.targetUser?.profileHandle,
        report.targetClip?.title,
        report.targetClip?.uploader?.username,
        report.targetMap?.title,
        report.targetId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [reports, tab, normalizedQuery]);

  const filteredBanned = useMemo(() => {
    if (!normalizedQuery) return bannedUsers;
    return bannedUsers.filter((user) =>
      `${user.username} ${user.profileHandle} ${user.discriminator}`.toLowerCase().includes(normalizedQuery)
    );
  }, [bannedUsers, normalizedQuery]);

  const openCount = (type: "user" | "clip" | "map") =>
    reports.filter((r) =>
      type === "map" ? (r.targetType === "daily_map" || r.targetType === "challenge_map") && r.status === "open" : r.targetType === type && r.status === "open"
    ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("user")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === "user" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"
            }`}
          >
            Users {openCount("user") > 0 && `(${openCount("user")})`}
          </button>
          <button
            onClick={() => setTab("clip")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === "clip" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"
            }`}
          >
            Posts {openCount("clip") > 0 && `(${openCount("clip")})`}
          </button>
          <button
            onClick={() => setTab("map")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === "map" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"
            }`}
          >
            Maps {openCount("map") > 0 && `(${openCount("map")})`}
          </button>
          <button
            onClick={() => setTab("banned")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === "banned" ? "bg-accent text-white" : "border border-border bg-white/5 text-muted hover:text-white"
            }`}
          >
            Banned users {bannedUsers.length > 0 && `(${bannedUsers.length})`}
          </button>
        </div>

        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "banned" ? "Search banned users..." : "Search reports by user..."}
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-accent"
          />
        </div>
      </div>

      {error && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

      {tab === "banned" ? (
        filteredBanned.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface/95 p-10 text-center text-sm text-muted">
            {normalizedQuery ? "No banned users match your search." : "No banned users."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBanned.map((user) => (
              <article key={user.id} className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-6 shadow-glow sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-lg font-semibold text-red-300">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{user.username}</p>
                    <p className="text-sm text-muted">@{user.profileHandle} · Banned {new Date(user.bannedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Unban ${user.username}?`)) unbanUser(user.id);
                  }}
                  disabled={busyId === user.id}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busyId === user.id ? "Unbanning..." : "Unban"}
                </button>
              </article>
            ))}
          </div>
        )
      ) : filteredReports.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface/95 p-10 text-center text-sm text-muted">
          {normalizedQuery ? "No reports match your search." : `No ${tab === "user" ? "user" : tab === "clip" ? "post" : "map"} reports yet.`}
        </div>
      ) : (
        <div className="space-y-4">
          {refreshMessage && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{refreshMessage}</div>
          )}
          {filteredReports.map((report) => {
            const isOpen = report.status === "open";
            const targetName = report.targetUser
              ? report.targetUser.username
              : report.targetClip
                ? report.targetClip.title
                : report.targetMap
                  ? report.targetMap.title
                  : "deleted content";
            const isMapReport = report.targetType === "daily_map" || report.targetType === "challenge_map";
            return (
              <article key={report.id} className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                        <Flag className="h-3 w-3" /> {report.reason}
                      </span>
                      <span className="rounded-full border border-border bg-white/5 px-2.5 py-0.5 text-xs text-muted">
                        {STATUS_LABEL[report.status] ?? report.status}
                      </span>
                      <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
                        {report.targetType === "daily_map" ? "Daily map" : "Challenge map"}
                      </span>
                      {report.targetUser?.isSuspended && (
                        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-xs text-red-300">
                          Banned
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white">Reported: {targetName}</h3>
                    {report.targetMap?.rating != null && (
                      <p className="mt-1 text-xs text-muted">Rating: {report.targetMap.rating.toFixed(2)}</p>
                    )}
                    <p className="mt-1 text-sm text-muted">
                      Reported by <span className="text-white">{report.reporter.username}#{report.reporter.discriminator}</span> on{" "}
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                    {report.description && (
                      <p className="mt-3 rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted">
                        {report.description}
                      </p>
                    )}
                  </div>

                  {isOpen && (
                    <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                      {isMapReport ? (
                        <div className="space-y-2">
                          {report.targetType === "daily_map" && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Refresh today's daily map? This replaces it for everyone in that rank.`)) refreshDaily(report.targetId);
                              }}
                              disabled={busyId === "refresh"}
                              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
                            >
                              <RefreshCw size={15} className={busyId === "refresh" ? "animate-spin" : ""} />
                              {busyId === "refresh" ? "Refreshing..." : "Refresh daily map"}
                            </button>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => runAction(report.id, "resolve")}
                              disabled={busyId === report.id}
                              className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => runAction(report.id, "dismiss")}
                              disabled={busyId === report.id}
                              className="rounded-full border border-border px-4 py-2 text-sm text-muted transition hover:text-white disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ) : (
                      <>
                        {warnFor === report.id ? (
                          <div className="space-y-2 rounded-2xl border border-border bg-background/60 p-3">
                            <textarea
                              value={warnMessage}
                              onChange={(event) => setWarnMessage(event.target.value)}
                              rows={2}
                              placeholder="Warning message sent to the user..."
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent"
                            />
                            <div className="flex gap-2">
                              <button
                                disabled={busyId === report.id || warnMessage.trim().length === 0}
                                onClick={() => runAction(report.id, "warn", warnMessage)}
                                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
                              >
                                Send warning
                              </button>
                              <button
                                onClick={() => setWarnFor(null)}
                                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setWarnFor(report.id); setWarnMessage(""); }}
                            disabled={busyId === report.id}
                            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
                          >
                            Warn
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Ban ${targetName} from the website?`)) {
                              runAction(report.id, "ban");
                            }
                          }}
                          disabled={busyId === report.id}
                          className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                        >
                          Ban
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => runAction(report.id, "resolve")}
                            disabled={busyId === report.id}
                            className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => runAction(report.id, "dismiss")}
                            disabled={busyId === report.id}
                            className="rounded-full border border-border px-4 py-2 text-sm text-muted transition hover:text-white disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
