"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Server, Tag as TagIcon } from "lucide-react";

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  mappedTagId: string | null;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

interface RolesResponse {
  guild: GuildInfo | null;
  roles: Role[];
  tags: Tag[];
}

export function DiscordIntegration() {
  const [data, setData] = useState<RolesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/discord/roles");
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to load Discord data");
      }
      const next = await response.json();
      setError(null);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Discord data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleMappingChange = async (role: Role, tagId: string) => {
    setSavingRole(role.id);
    setError(null);
    try {
      if (!tagId) {
        const response = await fetch(`/api/admin/discord/mappings/${role.id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to remove mapping");
      } else {
        const response = await fetch("/api/admin/discord/mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discordRoleId: role.id, tagId }),
        });
        if (!response.ok) throw new Error("Failed to save mapping");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update mapping");
    } finally {
      setSavingRole(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/discord/sync", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? "Sync failed");
      }
      setSyncResult(
        `${body.totalMembers} members fetched, ${body.matchedUsers} matched website accounts, ` +
          `${body.tagsApplied} tags applied, ${body.tagsRemoved} removed, ${body.markedLeft} marked as left.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-border bg-surface/95 p-8 text-sm text-muted shadow-glow">
        Loading Discord data...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {data?.guild?.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png?size=64`}
                alt=""
                className="h-12 w-12 rounded-full"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                <Server className="h-6 w-6 text-accent" />
              </div>
            )}
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accent">Guild status</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                {data?.guild?.name ?? "Discord bot not configured"}
              </h2>
              {data?.guild && (
                <p className="mt-1 text-sm text-muted">
                  {data.guild.memberCount} members · {data.roles.length} roles
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync all members"}
          </button>
        </div>

        {syncResult && (
          <p className="mt-5 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            {syncResult}
          </p>
        )}
        {error && (
          <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-surface/95 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Role to tag mapping</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Sync Discord roles to website tags</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            When a member picks roles in the Discord server, the roles they hold are mapped to the tag
            selected below and synced to their website profile. Tags without a mapping are left untouched.
          </p>
        </div>

        {data?.roles.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-background/70 p-8 text-center text-sm text-muted">
            No roles found. Make sure the bot can read the guild.
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-3xl border border-border">
            {data?.roles.map((role, index) => (
              <div
                key={role.id}
                className={`flex flex-col gap-3 bg-background/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                    style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#99aab5" }}
                  />
                  <span className="text-sm font-medium text-white">{role.name}</span>
                  {role.managed && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                      Managed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {savingRole === role.id && (
                    <span className="text-xs text-muted">Saving...</span>
                  )}
                  <select
                    value={role.mappedTagId ?? ""}
                    onChange={(event) => handleMappingChange(role, event.target.value)}
                    disabled={savingRole === role.id}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none transition focus:border-accent disabled:opacity-50 sm:w-56"
                  >
                    <option value="">No mapping</option>
                    {data?.tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {data?.tags.length === 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <TagIcon className="h-4 w-4" />
            No tags exist yet. Tags are created when users sign in or can be added later.
          </p>
        )}
      </section>
    </div>
  );
}
