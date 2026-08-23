import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getGuildMember, getGuildMemberById } from "@/lib/discord";
import { syncUserTagsFromDiscord } from "@/lib/discord-sync";
import { recordReferral, REFERRAL_COOKIE_NAME } from "@/lib/referrals";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

const AVAILABLE_TAGS = [
  "beginner",
  "intermediate",
  "experienced",
  "expert",
  "content-creator",
  "veteran",
  "rhythian-coach",
  "tester",
  "post-reviewer",
  "mentor",
  "camera-lock",
  "camera-spin",
  "camera-vr",
  "contributor",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", request.url));
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) return NextResponse.json({ error: "Discord OAuth not configured" }, { status: 500 });

  await ensureUserColumns();

  try {
    const tokenBody = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: process.env.DISCORD_REDIRECT_URI });
    const tokenResponse = await fetch(DISCORD_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody });
    if (!tokenResponse.ok) return NextResponse.redirect(new URL("/login?error=discord_token", request.url));

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userResponse = await fetch(DISCORD_USER_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) return NextResponse.redirect(new URL("/login?error=discord_user", request.url));

    const discordUser = await userResponse.json();
    const discordEmail: string | null = discordUser.email ? String(discordUser.email).toLowerCase() : null;
    const baseHandle = `${discordUser.username.toLowerCase()}-${discordUser.discriminator}`;
    const guildMember = await getGuildMember(accessToken);
    const inGuild = guildMember !== null;
    const discordRoles = guildMember?.roles ?? [];

    let user = await prisma.user.findUnique({ where: { discordId: discordUser.id } });
    let profileHandle: string | undefined;
    if (!user && discordEmail) user = await prisma.user.findUnique({ where: { email: discordEmail } });
    const isNewUser = !user;

    if (!user) {
      profileHandle = baseHandle;
      let suffix = 0;
      while (await prisma.user.findUnique({ where: { profileHandle } })) {
        suffix++;
        profileHandle = `${baseHandle}-${Math.random().toString(36).slice(2, 6)}`;
        if (suffix > 5) throw new Error("Could not allocate a unique profile handle");
      }
    }

    const profileData = { username: discordUser.username, discriminator: discordUser.discriminator, avatar: discordUser.avatar, locale: discordUser.locale, discordRoles, inGuild };
    user = user
      ? await prisma.user.update({ where: { id: user.id }, data: { ...profileData, discordId: discordUser.id } })
      : await prisma.user.create({ data: { ...profileData, discordId: discordUser.id, email: discordEmail, profileHandle: profileHandle! } });

    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID) {
      const botMember = await getGuildMemberById(process.env.DISCORD_BOT_TOKEN, process.env.DISCORD_GUILD_ID, discordUser.id);
      const verifiedInGuild = botMember !== null;
      const verifiedRoles = botMember?.roles ?? [];
      await prisma.user.update({ where: { id: user.id }, data: { discordRoles: verifiedRoles, inGuild: verifiedInGuild } });
      if (verifiedInGuild) await syncUserTagsFromDiscord(prisma, user.id, verifiedRoles);
      else await prisma.userTag.deleteMany({ where: { userId: user.id, source: "discord" } });
    } else if (inGuild) await syncUserTagsFromDiscord(prisma, user.id, discordRoles);
    else await prisma.userTag.deleteMany({ where: { userId: user.id, source: "discord" } });

    await ensureTagsExist();

    if (isNewUser) {
      const referralCookie = request.headers.get("cookie")?.match(new RegExp(`${REFERRAL_COOKIE_NAME}=([^;]+)`))?.[1];
      if (referralCookie) {
        try { await recordReferral(decodeURIComponent(referralCookie), user.id); } catch (error) { console.error("Failed to record referral:", error); }
      }
    }

    if ((await prisma.role.count()) === 0) {
      const permissions = await prisma.permission.findMany({ select: { id: true } });
      const adminRole = await prisma.role.create({ data: { name: "Admin", description: "Full access to community administration.", permissions: { create: permissions.map(({ id }) => ({ permissionId: id })) } } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });
    }

    const token = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", request.url));
    setSessionCookie(response, token);
    response.cookies.set({ name: REFERRAL_COOKIE_NAME, value: "", httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Discord OAuth callback failed:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}

async function ensureTagsExist() {
  for (const tagSlug of AVAILABLE_TAGS) {
    const tagName = tagSlug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    await prisma.tag.upsert({ where: { slug: tagSlug }, update: {}, create: { name: tagName, slug: tagSlug } });
  }
}

const USER_COLUMN_MIGRATIONS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mutedUntil" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rhp" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avgMapRating" DOUBLE PRECISION`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scoreImportDone" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dailyStreak" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastDailyBeatAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastRhythiaRpCheckAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rhythiaVerified" BOOLEAN NOT NULL DEFAULT false`,
];

let userColumnsEnsured = false;

async function ensureUserColumns() {
  if (userColumnsEnsured) return;
  try {
    for (const statement of USER_COLUMN_MIGRATIONS) await prisma.$executeRawUnsafe(statement);
    userColumnsEnsured = true;
  } catch (error) {
    console.error("Failed to ensure User columns exist:", error);
  }
}
