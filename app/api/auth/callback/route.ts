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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  const userResponse = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userResponse.ok) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const discordUser = await userResponse.json();
  const baseHandle = `${discordUser.username.toLowerCase()}-${discordUser.discriminator}`;

  const guildMember = await getGuildMember(accessToken);
  const inGuild = guildMember !== null;
  const discordRoles = guildMember?.roles ?? [];

  try {
    // 1. If a user already exists with this Discord ID, just update them.
    let user = await prisma.user.findUnique({ where: { discordId: discordUser.id } });

    // 2. Otherwise, try to link to an existing account that shares the same email
    //    (e.g. someone who registered with email/password first). This avoids a
    //    unique-constraint crash on `email` when the upsert tries to create a duplicate.
    if (!user && discordUser.email) {
      user = await prisma.user.findUnique({ where: { email: discordUser.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { discordId: discordUser.id },
        });
      }
    }

    // 3. If no matching account exists, create a brand-new one. Generate a unique
    //    profileHandle so we never collide with an existing handle, and only set
    //    the email if it isn't already claimed by another account.
    if (!user) {
      const profileHandle = await generateUniqueHandle(baseHandle);
      const email = await safeEmailForUser(discordUser.email, null);
      user = await prisma.user.create({
        data: {
          discordId: discordUser.id,
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
          email,
          locale: discordUser.locale,
          profileHandle,
          discordRoles,
          inGuild,
        },
      });
    } else {
      // 4. Existing user (linked or already Discord-linked): refresh their profile
      //    data. Only set the email if it isn't already claimed by a DIFFERENT
      //    account — otherwise the unique constraint on `email` throws and the
      //    whole login fails with a 500 / oauth_failed.
      const email = await safeEmailForUser(discordUser.email, user.id);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
          email,
          locale: discordUser.locale,
          discordRoles,
          inGuild,
        },
      });
    }

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

// Returns the Discord email only if it isn't already claimed by another account.
// `currentUserId` is the user being updated (null when creating a new user). If
// the email belongs to a different user, we return null so the unique constraint
// on `email` never throws and the login doesn't fail.
async function safeEmailForUser(
  email: string | null | undefined,
  currentUserId: string | null
): Promise<string | null> {
  if (!email) return null;
  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner && owner.id !== currentUserId) return null;
  return email;
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
