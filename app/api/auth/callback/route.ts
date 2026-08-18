import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getGuildMember } from "@/lib/discord";
import { syncUserTagsFromDiscord } from "@/lib/discord-sync";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    console.error("Discord OAuth environment variables are missing.");
    return NextResponse.redirect(new URL("/login?error=discord_config", request.url));
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
    console.error("Discord token exchange failed:", tokenResponse.status);
    return NextResponse.redirect(new URL("/login?error=discord_config", request.url));
  }

  let tokenData: { access_token?: unknown };
  try {
    tokenData = await tokenResponse.json();
  } catch (error) {
    console.error("Discord token response was not valid JSON:", error);
    return NextResponse.redirect(new URL("/login?error=discord_token", request.url));
  }
  const accessToken = tokenData.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.redirect(new URL("/login?error=discord_token", request.url));
  }

  let userResponse: Response;
  try {
    userResponse = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Discord user request failed:", error);
    return NextResponse.redirect(new URL("/login?error=discord_network", request.url));
  }

  if (!userResponse.ok) {
    console.error("Discord user lookup failed:", userResponse.status);
    return NextResponse.redirect(new URL("/login?error=discord_user", request.url));
  }

  let discordUser: {
    id?: unknown;
    username?: unknown;
    discriminator?: unknown;
    avatar?: string | null;
    locale?: string | null;
  };
  try {
    discordUser = await userResponse.json();
  } catch (error) {
    console.error("Discord user response was not valid JSON:", error);
    return NextResponse.redirect(new URL("/login?error=discord_user", request.url));
  }
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
      const profileHandle = await generateUniqueHandle(username, discordId);
      user = await prisma.user.create({
        data: { discordId, username, discriminator, avatar: discordUser.avatar, locale: discordUser.locale, profileHandle, discordRoles, inGuild },
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

async function generateUniqueHandle(username: string, discordId: string): Promise<string> {
  const base = username.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "user";
  const root = `${base}-${discordId.slice(-8)}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const handle = attempt === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 7)}`;
    if (!(await prisma.user.findUnique({ where: { profileHandle: handle } }))) return handle;
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