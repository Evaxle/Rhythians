import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getGuildMember } from "@/lib/discord";
import { syncUserTagsFromDiscord } from "@/lib/discord-sync";

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

  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
    return NextResponse.json({ error: "Discord OAuth not configured" }, { status: 500 });
  }

  try {
    const tokenBody = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    });

    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL("/login?error=discord_token", request.url));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const userResponse = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(new URL("/login?error=discord_user", request.url));
    }

    const discordUser = await userResponse.json();
    const discordEmail: string | null = discordUser.email ? String(discordUser.email).toLowerCase() : null;
    const baseHandle = `${discordUser.username.toLowerCase()}-${discordUser.discriminator}`;

    const guildMember = await getGuildMember(accessToken);
    const inGuild = guildMember !== null;
    const discordRoles = guildMember?.roles ?? [];

    // Match by Discord ID first, then fall back to the verified email so a
    // password-registered account gets linked instead of colliding on email.
    let user = await prisma.user.findUnique({ where: { discordId: discordUser.id } });
    let profileHandle: string | undefined;
    if (!user && discordEmail) {
      user = await prisma.user.findUnique({ where: { email: discordEmail } });
    }
    if (!user) {
      // New account: guarantee a unique profile handle.
      profileHandle = baseHandle;
      let suffix = 0;
      while (await prisma.user.findUnique({ where: { profileHandle } })) {
        suffix++;
        profileHandle = `${baseHandle}-${Math.random().toString(36).slice(2, 6)}`;
        if (suffix > 5) throw new Error("Could not allocate a unique profile handle");
      }
    }

    const profileData = {
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      locale: discordUser.locale,
      discordRoles,
      inGuild,
    };

    user = user
      ? await prisma.user.update({
          where: { id: user.id },
          data: { ...profileData, discordId: discordUser.id },
        })
      : await prisma.user.create({
          data: {
            ...profileData,
            discordId: discordUser.id,
            email: discordEmail,
            profileHandle: profileHandle!,
          },
        });

    await ensureTagsExist();

    if (inGuild) {
      await syncUserTagsFromDiscord(prisma, user.id, discordRoles);
    } else {
      await prisma.userTag.deleteMany({ where: { userId: user.id, source: "discord" } });
    }

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

    const token = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", request.url));
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("Discord OAuth callback failed:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
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