import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  syncUserFromDiscordRoles,
  markUserLeftGuild,
  syncAllGuildMembers,
} from "../lib/discord-sync";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

async function syncMemberRoles(discordUserId: string, roleIds: string[]) {
  try {
    const result = await syncUserFromDiscordRoles(prisma, discordUserId, roleIds, true);
    if (result) {
      console.log(`[sync] ${discordUserId}: ${result.applied} tags applied, ${result.removed} removed`);
    }
  } catch (error) {
    console.error(`[sync] Failed to sync member ${discordUserId}:`, error);
  }
}

async function syncAllMembers() {
  try {
    const result = await syncAllGuildMembers(prisma, token!, guildId!);
    console.log(
      `[sync] Full sync: ${result.totalMembers} members, ${result.matchedUsers} matched, ` +
        `${result.tagsApplied} tags applied, ${result.tagsRemoved} removed, ${result.markedLeft} marked left`
    );
  } catch (error) {
    console.error("[sync] Failed to run full sync:", error);
  }
}

client.once("ready", async () => {
  console.log(`Discord bot ready as ${client.user?.tag}`);

  const guild = client.guilds.cache.get(guildId!);
  if (guild) {
    console.log(`[guild] Connected to ${guild.name} (${guild.memberCount} members)`);
  }

  await syncAllMembers();
  setInterval(syncAllMembers, 60_000);
  console.log("[sync] Scheduled full sync every 60 seconds");
});

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== guildId) return;
  if (member.user.bot) return;
  console.log(`[join] ${member.user.tag} joined`);
  await syncMemberRoles(member.id, [...member.roles.cache.keys()]);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (newMember.guild.id !== guildId) return;
  if (newMember.user.bot) return;

  const oldRoles = new Set(oldMember.roles.cache.keys());
  const newRoles = new Set(newMember.roles.cache.keys());
  const changed =
    oldRoles.size !== newRoles.size ||
    [...newRoles].some((roleId) => !oldRoles.has(roleId));

  if (changed) {
    console.log(`[roles] ${newMember.user.tag} role change`);
    await syncMemberRoles(newMember.id, [...newRoles]);
  }
});

client.on("guildMemberRemove", async (member) => {
  if (member.guild.id !== guildId) return;
  if (member.user.bot) return;
  console.log(`[leave] ${member.user.tag} left`);
  try {
    await markUserLeftGuild(prisma, member.id);
  } catch (error) {
    console.error(`[leave] Failed to mark ${member.id} as left:`, error);
  }
});

client.login(token);
