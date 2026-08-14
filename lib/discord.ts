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
