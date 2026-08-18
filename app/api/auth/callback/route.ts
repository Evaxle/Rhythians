import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getGuildMember } from "@/lib/discord";
import { syncUserTagsFromDiscord } from "@/lib/discord-sync";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

export const runtime = "nodejs";

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
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const redirectUri = process.env.DISCORD_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Discord OAuth not configured" }, { status: 500 });
  }

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
      cache: "no-store",
    });
  } catch (error) {
    console.error("Discord token request failed:", error);
    return NextResponse.redirect(new URL("/login?error=discord_network", request.url));
  }

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "");
    console.error("Discord token exchange failed:", tokenResponse.status, detail.slice(0, 300));
    return NextResponse.redirect(new URL("/login?error=discord_config", request.url));
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.redirect(new URL("/login?error=discord_token", request.url));
  }

  const userResponse = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userResponse.ok) {
    console.error("Discord user lookup failed:", userResponse.status);
    return NextResponse.redirect(new URL("/login?error=discord_user", request.url));
  }

  const discordUser = await userResponse.json();
  const discordId = typeof discordUser.id === "string" ? discordUser.id : "";
  const username = typeof discordUser.username === "string" ? discordUser.username.trim() : "";
  if (!discordId || !username) {
    return NextResponse.redirect(new URL("/login?error=discord_user", request.url));
  }
  const discriminator = typeof discordUser.discriminator === "string" && discordUser.discriminator
    ? discordUser.discriminator
    : "0";

  const guildMember = await getGuildMember(accessToken);
  const inGuild = guildMember !== null;
  const discordRoles = guildMember?.roles ?? [];

  try {
    let user = await prisma.user.findUnique({ where: { discordId } });
    if (!user) {
      const profileHandle = await generateUniqueHandle(`${username.toLowerCase()}-${discriminator}`);
      user = await prisma.user.create({
        data: {
          discordId,
          username,
          discriminator,
          avatar: discordUser.avatar,
          locale: discordUser.locale,
          profileHandle,
          discordRoles,
          inGuild,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { username, discriminator, avatar: discordUser.avatar, locale: discordUser.locale, discordRoles, inGuild },
      });
    }

    try {
      await ensureTagsExist();
      if (inGuild) await syncUserTagsFromDiscord(prisma, user.id, discordRoles);
      else await prisma.userTag.deleteMany({ where: { userId: user.id, source: "discord" } });
    } catch (error) {
      console.error("Discord tag sync skipped:", error);
    }

    const token = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", request.url));
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("Discord account setup failed:", { code, message: message.slice(0, 500) });
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}

async function generateUniqueHandle(baseHandle: string): Promise<string> {
  let handle = baseHandle;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (!(await prisma.user.findUnique({ where: { profileHandle: handle } }))) return handle;
    handle = `${baseHandle}-${Math.random().toString(36).slice(2, 7)}`;
  }
  throw new Error("Unable to create a unique profile handle");
}

async function ensureTagsExist() {
  for (const tagSlug of AVAILABLE_TAGS) {
    const tagName = tagSlug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    await prisma.tag.upsert({
      where: { slug: tagSlug },
      update: {},
      create: { name: tagName, slug: tagSlug },
    });
  }
}
