"use client";

import { useState } from "react";
import { User, Search, ShieldAlert, ShieldOff, BellOff, Bell, TriangleAlert, RotateCcw } from "lucide-react";
import { FlagIcon } from "@/components/flag-icon";
import { getRankInfo } from "@/lib/ranks";

type SearchedUser = {
  id: string;
  username: string;
  discriminator: string;
  displayName: string | null;
  profileHandle: string;
  discordId: string | null;
  email: string | null;
  hasPassword: boolean;
  avatar: string | null;
  bio: string | null;
  website: string | null;
  inGuild: boolean;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  playerRank: string | null;
  userTags: Array<{ tag: { name: string; slug: string } }>;
  roles: string[];
  warnings: Array<{ id: string; reason: string; createdAt: string; actor: string }>;
  rhythiaProfile: {
    profileId: number;
    profileUrl: string;
    username: string | null;
    country: string | null;
    flag: string | null;
    globalRank: number | null;
    countryRank: number | null;
    rhythmPoints: number | null;
    isOnline: boolean | null;
    lastActiveAt: string | null;
    syncedAt: string;
  } | null;
  stats: { clips: number; comments: number; messages: number; reportsFiled: number; warnings: number };
  ranked: {
    rhp: number;
    avgMapRating: number | null;
    scoreImportDone: boolean;
    dailyStreak: number;
    lastDailyBeatAt: string | null;
    lastRhythiaRpCheckAt: string | null;
    rhythiaVerified: boolean;
    completions: number;
    dailyBeats: number;
    rhpTransactions: number;
  };
  moderation: {
    isSuspended: boolean;
    suspensionExpiry: string | null;
    isMuted: boolean;
    muteExpiry: string | null;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}

function timeUntil(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h remaining`;
  const mins = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  return `${hours > 0 ? `${hours}h ` : ""}${mins}m remaining`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-accent">{label}</span>
      <span className="break-all text-right text-sm text-white">{value}</span>
    </div>
  );
}

export function AdminUserSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [user, setUser] = useState<SearchedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [editForm, setEditForm] = useState({ displayName: "", bio: "", website: "", profileHandle: "" });
  const [rhpInput, setRhpInput] = useState("");
  const [resetting, setResetting] = useState(false);

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setError("");
    setSearched(false);
    setUser(null);
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not find this user.");
      if (!data.user) {
        setSearched(true);
        return;
      }
      setUser(data.user);
      setEditForm({
        displayName: data.user.displayName ?? "",
        bio: data.user.bio ?? "",
        website: data.user.website ?? "",
        profileHandle: data.user.profileHandle,
      });
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Could not find this user.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function act(payload: Record<string, unknown>) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/moderation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      await search();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save changes.");
      setShowEdit(false);
      await search();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRhp() {
    if (!user) return;
    const rhp = Number(rhpInput);
    if (!Number.isFinite(rhp) || rhp < 0) {
      setError("Enter a valid RHP value (0 or more).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rhp: Math.round(rhp) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update RHP.");
      setRhpInput("");
      await search();
    } catch (rhpError) {
      setError(rhpError instanceof Error ? rhpError.message : "Could not update RHP.");
    } finally {
      setBusy(false);
    }
  }

  async function resetRanked() {
    if (!user) return;
    if (!window.confirm(`Reset ${user.displayName ?? user.username}'s entire ranked status? This sets RHP, rank, tier, and all completed map history back to zero. This cannot be undone.`)) return;
    setResetting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetRanked: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not reset ranked status.");
      await search();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset ranked status.");
    } finally {
      setResetting(false);
    }
  }

  const durationOptions = [1, 3, 7, 14, 30, 90, 365];
  const hourOptions = [1, 6, 12, 24, 72, 168, 720];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface/95 p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <User size={20} />
          </div>
          <div>
            <p className="font-semibold text-white">Find a user</p>
            <p className="text-sm text-muted">Search by username, handle, Discord ID, or email.</p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users…"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
          >
            <Search size={16} />
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
      ) : null}

      {searched && !user && !loading && !error ? (
        <p className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted">No user found.</p>
      ) : null}

      {user ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white">
                    {user.displayName ?? user.username}
                  </h2>
                  {user.moderation.isSuspended && (
                    <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-300">
                      {user.moderation.suspensionExpiry ? "Suspended" : "Banned"}
                    </span>
                  )}
                  {user.moderation.isMuted && (
                    <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-300">
                      Muted
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  @{user.profileHandle} · {user.username}#{user.discriminator}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {user.userTags.map((ut) => (
                    <span key={ut.tag.slug} className="rounded-full border border-border bg-white/5 px-2 py-0.5 text-white">
                      {ut.tag.name}
                    </span>
                  ))}
                  {user.userTags.length === 0 && "No tags"}
                </p>
              </div>
              <button
                onClick={() => setShowEdit((current) => !current)}
                disabled={busy}
                className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent/40 disabled:opacity-50"
              >
                {showEdit ? "Close editor" : "Edit account"}
              </button>
            </div>

            {showEdit && (
              <div className="mt-6 space-y-4 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Edit account</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Display name</span>
                    <input
                      value={editForm.displayName}
                      onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Profile handle</span>
                    <input
                      value={editForm.profileHandle}
                      onChange={(e) => setEditForm({ ...editForm, profileHandle: e.target.value })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Website</span>
                    <input
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-muted">Bio</span>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    />
                  </label>
                </div>
                <button
                  onClick={saveEdit}
                  disabled={busy}
                  className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Account</p>
                <InfoRow label="User ID" value={user.id} />
                <InfoRow label="Discord ID" value={user.discordId ?? "—"} />
                <InfoRow
                  label="Login method"
                  value={[
                    user.discordId ? "Discord" : null,
                    user.hasPassword ? "Password" : null,
                  ].filter(Boolean).join(" + ") || "Unknown"}
                />
                <InfoRow label="Email" value={user.email ?? "—"} />
                <InfoRow label="Joined" value={formatDate(user.joinedAt)} />
                <InfoRow label="Last updated" value={formatDate(user.updatedAt)} />
                <InfoRow label="In Discord server" value={user.inGuild ? "Yes" : "No"} />
                <InfoRow label="Onboarding" value={user.onboardingCompleted ? "Completed" : "Pending"} />
                <InfoRow label="Player rank" value={user.playerRank ?? "—"} />
                <InfoRow label="Roles" value={user.roles.length ? user.roles.join(", ") : "None"} />
              </div>

              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Rhythia profile</p>
                {user.rhythiaProfile ? (
                  <>
                    <InfoRow
                      label="Player"
                      value={
                        <span className="inline-flex items-center gap-2">
                          {user.rhythiaProfile.username ?? `#${user.rhythiaProfile.profileId}`}
                          <FlagIcon flag={user.rhythiaProfile.flag} country={user.rhythiaProfile.country} />
                        </span>
                      }
                    />
                    <InfoRow label="Status" value={user.rhythiaProfile.isOnline ? "Online" : "Offline"} />
                    <InfoRow label="Last active" value={formatDate(user.rhythiaProfile.lastActiveAt)} />
                    <InfoRow label="Global rank" value={user.rhythiaProfile.globalRank ? `#${user.rhythiaProfile.globalRank.toLocaleString()}` : "—"} />
                    <InfoRow label="Country rank" value={user.rhythiaProfile.countryRank ? `#${user.rhythiaProfile.countryRank.toLocaleString()}` : "—"} />
                    <InfoRow label="Rhythm points" value={user.rhythiaProfile.rhythmPoints === null ? "—" : user.rhythiaProfile.rhythmPoints.toLocaleString()} />
                    <InfoRow label="Synced" value={formatDate(user.rhythiaProfile.syncedAt)} />
                    <a href={user.rhythiaProfile.profileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-accent hover:text-white">
                      View on Rhythia →
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-muted">No linked Rhythia profile.</p>
                )}
              </div>

              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Stats</p>
                <InfoRow label="Clips" value={user.stats.clips} />
                <InfoRow label="Comments" value={user.stats.comments} />
                <InfoRow label="Messages" value={user.stats.messages} />
                <InfoRow label="Reports filed" value={user.stats.reportsFiled} />
                <InfoRow label="Warnings" value={user.stats.warnings} />
              </div>

              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Ranked status</p>
                {(() => {
                  const rankInfo = getRankInfo(user.ranked.rhp);
                  const rankLabel = rankInfo.isExpert ? "Expert" : `${rankInfo.name} ${rankInfo.tier}`;
                  return (
                    <>
                      <InfoRow label="RHP" value={user.ranked.rhp.toLocaleString()} />
                      <InfoRow label="Rank / tier" value={rankLabel} />
                      <InfoRow label="Avg map rating" value={user.ranked.avgMapRating == null ? "—" : user.ranked.avgMapRating.toFixed(2)} />
                      <InfoRow label="Daily streak" value={user.ranked.dailyStreak} />
                      <InfoRow label="Maps completed" value={user.ranked.completions} />
                      <InfoRow label="Daily maps beaten" value={user.ranked.dailyBeats} />
                      <InfoRow label="RHP transactions" value={user.ranked.rhpTransactions} />
                      <InfoRow label="Score import" value={user.ranked.scoreImportDone ? "Done" : "Pending"} />
                      <InfoRow label="Rhythia verified" value={user.ranked.rhythiaVerified ? "Yes" : "No"} />
                      <InfoRow label="Last daily beat" value={formatDate(user.ranked.lastDailyBeatAt)} />
                      <InfoRow label="Last RP check" value={formatDate(user.ranked.lastRhythiaRpCheckAt)} />
                    </>
                  );
                })()}

                <div className="mt-2 border-t border-border pt-3">
                  <p className="text-xs text-muted">Set RHP directly</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={rhpInput}
                      onChange={(e) => setRhpInput(e.target.value)}
                      type="number"
                      min={0}
                      placeholder={String(user.ranked.rhp)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    />
                    <button
                      onClick={saveRhp}
                      disabled={busy || rhpInput === ""}
                      className="shrink-0 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent2 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={resetRanked}
                  disabled={resetting || busy}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/20 disabled:opacity-50"
                >
                  <RotateCcw size={13} /> {resetting ? "Resetting…" : "Reset ranked status to zero"}
                </button>
              </div>

              <div className="space-y-3 rounded-3xl border border-border bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Warnings</p>
                {user.warnings.length === 0 ? (
                  <p className="text-sm text-muted">No warnings recorded.</p>
                ) : (
                  user.warnings.map((warning) => (
                    <div key={warning.id} className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3">
                      <p className="text-sm text-white">{warning.reason}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(warning.createdAt)} · by {warning.actor}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-6 shadow-glow">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-red-300" />
                <p className="font-semibold text-white">Moderation</p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-white">Ban / Suspend</p>
                  <p className="mt-1 text-xs text-muted">
                    {user.moderation.isSuspended
                      ? timeUntil(user.moderation.suspensionExpiry) ?? "Banned permanently"
                      : "Ban removes access immediately. Suspensions are time-limited."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!user.moderation.isSuspended && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => act({ action: "ban" })}
                          className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                        >
                          Ban permanently
                        </button>
                        {durationOptions.map((days) => (
                          <button
                            key={days}
                            disabled={busy}
                            onClick={() => act({ action: "suspend", days })}
                            className="rounded-full border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
                          >
                            {days}d
                          </button>
                        ))}
                      </>
                    )}
                    {user.moderation.isSuspended && (
                      <button
                        disabled={busy}
                        onClick={() => act({ action: "unsuspend" })}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-1.5"><ShieldOff size={14} /> Reinstate</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-white">Mute (messages & comments)</p>
                  <p className="mt-1 text-xs text-muted">
                    {user.moderation.isMuted ? `Muted ${timeUntil(user.moderation.muteExpiry) ?? "indefinitely"}` : "Prevents sending messages and comments."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!user.moderation.isMuted &&
                      hourOptions.map((hours) => (
                        <button
                          key={hours}
                          disabled={busy}
                          onClick={() => act({ action: "mute", hours })}
                          className="rounded-full border border-yellow-400/40 px-3 py-2 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-400/10 disabled:opacity-50"
                        >
                          {hours >= 24 ? `${hours / 24}d` : `${hours}h`}
                        </button>
                      ))}
                    {user.moderation.isMuted && (
                      <button
                        disabled={busy}
                        onClick={() => act({ action: "unmute" })}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-1.5"><Bell size={14} /> Unmute</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-white">Warning</p>
                  <p className="mt-1 text-xs text-muted">Sends the user a warning notification that appears on their page.</p>
                  <textarea
                    id="warning-reason"
                    placeholder="Reason for the warning…"
                    rows={2}
                    value={warningReason}
                    onChange={(e) => setWarningReason(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent"
                  />
                  <button
                    disabled={busy || !warningReason.trim()}
                    onClick={() => {
                      act({ action: "warn", reason: warningReason });
                      setWarningReason("");
                    }}
                    className="mt-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1.5"><TriangleAlert size={14} /> Send warning</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/60 p-6 shadow-glow">
              <div className="flex items-center gap-3">
                <BellOff className="h-5 w-5 text-muted" />
                <p className="font-semibold text-white">Quick actions</p>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <a
                  href={`/profile/${user.profileHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-border bg-background p-4 text-white transition hover:border-accent/40"
                >
                  View public profile →
                </a>
                <a
                  href={`/messages?user=${encodeURIComponent(user.profileHandle)}`}
                  className="block rounded-2xl border border-border bg-background p-4 text-white transition hover:border-accent/40"
                >
                  Open conversation →
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}