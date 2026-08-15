const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface DiscordGuildMember {
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  nick?: string;
  roles: string[];
  joined_at: string;
}

export async function getGuildMember(accessToken: string): Promise<DiscordGuildMember | null> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return null;

  try {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Discord API error: ${response.status}`);
    }

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
};

export function mapDiscordRolesToTags(discordRoles: string[], roleMappings: Record<string, string>): string[] {
  const tags: string[] = [];
  
  for (const roleId of discordRoles) {
    const roleName = roleMappings[roleId];
    if (roleName) {
      const normalizedRole = roleName.toLowerCase();
      const tagSlug = ROLE_TO_TAG_MAP[normalizedRole];
      if (tagSlug && !tags.includes(tagSlug)) {
        tags.push(tagSlug);
      }
    }
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

function botAuth(token: string) {
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

export async function getGuildInfo(token: string, guildId: string): Promise<DiscordGuildInfo | null> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}`, { headers: botAuth(token) });
    if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch guild info:", error);
    return null;
  }
}

export async function getGuildRoles(token: string, guildId: string): Promise<DiscordRole[]> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, { headers: botAuth(token) });
    if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch guild roles:", error);
    return [];
  }
}

export async function getGuildMemberById(token: string, guildId: string, userId: string): Promise<DiscordGuildMember | null> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, { headers: botAuth(token) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch guild member:", error);
    return null;
  }
}

export async function getAllGuildMembers(token: string, guildId: string): Promise<DiscordGuildMember[]> {
  const members: DiscordGuildMember[] = [];
  let after: string | undefined;

  try {
    for (let i = 0; i < 50; i++) {
      const params = new URLSearchParams({ limit: "100" });
      if (after) params.set("after", after);
      const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members?${params}`, {
        headers: botAuth(token),
      });
      if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
      const batch = await response.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      members.push(...batch);
      after = batch[batch.length - 1].user?.id;
      if (!after || batch.length < 100) break;
    }
  } catch (error) {
    console.error("Failed to fetch guild members:", error);
  }

  return members;
}
