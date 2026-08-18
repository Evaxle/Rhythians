import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getGuildMember } from "@/lib/discord";
import { syncUserTagsFromDiscord } from "@/lib/discord-sync";

export const runtime = "nodejs";

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
    console.error("Discord user response was missing id or username.");
    return NextResponse.redirect(new URL("/login?error=discord_user", request.url));
  }
  const discriminator = typeof discordUser.discriminator === "string" && discordUser.discriminator
    ? discordUser.discriminator
    : "0";
  const baseHandle = `${username.toLowerCase()}-${discriminator}`;

  const guildMember = await getGuildMember(accessToken);
  const inGuild = guildMember !== null;
  const discordRoles = guildMember?.roles ?? [];

  try {
    // 1. If a user already exists with this Discord ID, just update them.
    let user = await prisma.user.findUnique({ where: { discordId } });

    // 2. If no matching account exists, create a brand-new one.
    if (!user) {
      const profileHandle = await generateUniqueHandle(baseHandle);
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
      // 3. Existing Discord user: refresh their profile data without storing email.
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username,
          discriminator,
          avatar: discordUser.avatar,
          locale: discordUser.locale,
          discordRoles,
          inGuild,
        },
      });
    }

    // Tags, Discord-role synchronization, and default-role repair are optional.
    // They must never prevent a valid Discord account from receiving a session.
    try {
      await ensureTagsExist();
      if (inGuild) {
        await syncUserTagsFromDiscord(prisma, user.id, discordRoles);
      } else {
        await prisma.userTag.deleteMany({ where: { userId: user.id, source: "discord" } });
      }
    } catch (error) {
      console.error("Discord role/tag sync skipped:", error);
    }

    try {
      if ((await prisma.role.count()) === 0) {
        const permissions = await prisma.permission.findMany({ select: { id: true } });
        const adminRole = await prisma.role.create({
          data: {
            name: "Admin",
            description: "Full access to community administration.",
            permissions: {
              create: permissions.map(({ id }) => ({ permissionId: id })),
            },
          },
        });
        await prisma.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });
      }
    } catch (error) {
      console.error("Default role repair skipped:", error);
    }

    const token = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", request.url));
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("Discord OAuth callback failed:", { code, message: message.slice(0, 500) });
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}

async function generateUniqueHandle(baseHandle: string): Promise<string> {
  let profileHandle = baseHandle;
  let attempts = 0;
  while (await prisma.user.findUnique({ where: { profileHandle } })) {
    attempts++;
    if (attempts > 5) {
      profileHandle = `${baseHandle}-${Math.random().toString(36).slice(2, 6)}`;
      break;
    }
    profileHandle = `${baseHandle}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return profileHandle;
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
