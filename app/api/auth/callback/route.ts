import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { getGuildMember, mapDiscordRolesToTags } from "@/lib/discord";

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
  const handle = `${discordUser.username.toLowerCase()}-${discordUser.discriminator}`;

  const guildMember = await getGuildMember(accessToken);
  const inGuild = guildMember !== null;
  const discordRoles = guildMember?.roles ?? [];

  const [user] = await Promise.all([
    prisma.user.upsert({
      where: { discordId: discordUser.id },
      update: {
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
        email: discordUser.email,
        locale: discordUser.locale,
        profileHandle: handle,
        discordRoles,
        inGuild,
      },
      create: {
        discordId: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
        email: discordUser.email,
        locale: discordUser.locale,
        profileHandle: handle,
        discordRoles,
        inGuild,
      },
    }),
  ]);

  await ensureTagsExist();

  if (inGuild && discordRoles.length > 0) {
    await syncUserTags(user.id, discordRoles);
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
  response.cookies.set({
    name: process.env.SESSION_COOKIE_NAME ?? "rhythians_session",
    value: token,
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Number(process.env.SESSION_EXPIRES_DAYS ?? 30) * 24 * 60 * 60,
  });

  return response;
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

async function syncUserTags(userId: string, discordRoles: string[]) {
  const roleMappings = await prisma.discordRoleMapping.findMany();
  const roleIdToName: Record<string, string> = {};
  for (const mapping of roleMappings) {
    const role = await prisma.role.findUnique({ where: { id: mapping.roleId } });
    if (role) roleIdToName[mapping.discordRoleId] = role.name;
  }

  const tagSlugs = mapDiscordRolesToTags(discordRoles, roleIdToName);

  const tags = await prisma.tag.findMany({ where: { slug: { in: tagSlugs } } });

  await prisma.userTag.deleteMany({ where: { userId } });

  if (tags.length > 0) {
    await prisma.userTag.createMany({
      data: tags.map(tag => ({ userId, tagId: tag.id })),
    });
  }
}
