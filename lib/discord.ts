const DISCORD_API_BASE = "https://discord.com/api/v10";

export class DiscordApiError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(status: number, retryAfterMs?: number) {
    super(`Discord API error: ${status}`);
    this.name = "DiscordApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface DiscordGuildMember {
  user?: { id: string; username: string; discriminator: string; avatar?: string };
  nick?: string;
  roles: string[];
  joined_at: string;
}

function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return 1000;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(250, Math.ceil(seconds * 1000));
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(250, date - Date.now()) : 1000;
}

function botAuth(token: string) {
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

async function discordFetch(url: string, token: string, attempts = 4): Promise<Response> {
  let lastRetry = 1000;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, { headers: botAuth(token), cache: "no-store" });
    if (response.status !== 429) return response;
    lastRetry = retryAfterMs(response);
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, lastRetry));
  }
  throw new DiscordApiError(429, lastRetry);
}

export async function getGuildMember(accessToken: string): Promise<DiscordGuildMember | null> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return null;
  try {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new DiscordApiError(response.status, retryAfterMs(response));
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch guild member:", error);
    return null;
  }
}

export const ROLE_TO_TAG_MAP: Record<string, string> = {
  beginner: "beginner",
  intermediate: "intermediate",
  experienced: "experienced",
  expert: "expert",
  "content creator": "content-creator",
  veteran: "veteran",
  "rhythian coach": "rhythian-coach",
  tester: "tester",
  admin: "admin",
  mentor: "mentor",
  "post-reviewer": "post-reviewer",
  "map-reviewer": "map-reviewer",
  mapper: "mapper",
  developer: "developer",
  owner: "owner",
};

export function mapDiscordRolesToTags(discordRoles: string[], roleMappings: Record<string, string>): string[] {
  const tags: string[] = [];
  for (const roleId of discordRoles) {
    const roleName = roleMappings[roleId];
    if (!roleName) continue;
    const tagSlug = ROLE_TO_TAG_MAP[roleName.toLowerCase()];
    if (tagSlug && !tags.includes(tagSlug)) tags.push(tagSlug);
  }
  return tags;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
  permissions: string;
}

export interface DiscordGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  approximate_member_count?: number;
  member_count?: number;
}

export async function validateDiscordBot(token: string, guildId: string) {
  const response = await discordFetch(`${DISCORD_API_BASE}/guilds/${guildId}`, token);
  if (response.status === 401) throw new DiscordApiError(401);
  if (response.status === 404) throw new DiscordApiError(404);
  if (!response.ok) throw new DiscordApiError(response.status, retryAfterMs(response));
  return await response.json() as DiscordGuildInfo;
}

export async function getGuildInfo(token: string, guildId: string): Promise<DiscordGuildInfo | null> {
  try {
    return await validateDiscordBot(token, guildId);
  } catch (error) {
    console.error("Failed to fetch guild info:", error);
    return null;
  }
}

export async function getGuildRoles(token: string, guildId: string): Promise<DiscordRole[]> {
  try {
    const response = await discordFetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, token);
    if (!response.ok) throw new DiscordApiError(response.status, retryAfterMs(response));
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch guild roles:", error);
    return [];
  }
}

export async function getGuildMemberById(token: string, guildId: string, userId: string): Promise<DiscordGuildMember | null> {
  const response = await discordFetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, token);
  if (response.status === 404) return null;
  if (!response.ok) throw new DiscordApiError(response.status, retryAfterMs(response));
  return await response.json();
}

export async function getAllGuildMembers(token: string, guildId: string): Promise<DiscordGuildMember[]> {
  const members: DiscordGuildMember[] = [];
  let after: string | undefined;
  for (let i = 0; i < 50; i++) {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    const response = await discordFetch(`${DISCORD_API_BASE}/guilds/${guildId}/members?${params}`, token);
    if (!response.ok) throw new DiscordApiError(response.status, retryAfterMs(response));
    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    members.push(...batch);
    after = batch[batch.length - 1].user?.id;
    if (!after || batch.length < 100) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return members;
}
