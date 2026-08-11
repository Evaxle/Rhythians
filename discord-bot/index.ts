import { Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once("ready", () => {
  console.log(`Discord bot ready as ${client.user?.tag}`);
});

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== guildId) return;
  console.log(`Member joined: ${member.user.tag}`);
});

client.login(token);
