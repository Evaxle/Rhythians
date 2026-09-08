import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { getAvatarUrl } from "@/lib/avatar";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const profiles = await prisma.rhythiaProfile.findMany({
    where: q ? {
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { user: { username: { contains: q, mode: "insensitive" } } },
        { user: { displayName: { contains: q, mode: "insensitive" } } },
        { user: { profileHandle: { contains: q, mode: "insensitive" } } },
      ],
    } : undefined,
    select: {
      userId: true,
      profileId: true,
      username: true,
      globalRank: true,
      profileUrl: true,
      country: true,
      flag: true,
      user: { select: { username: true, displayName: true, profileHandle: true, avatar: true, discordId: true } },
    },
    orderBy: [{ globalRank: "asc" }, { username: "asc" }],
    take: q ? 100 : 75,
  });

  return NextResponse.json({
    users: profiles.map((profile) => ({
      ...profile,
      avatarUrl: getAvatarUrl(profile.user, 128),
    })),
  });
}
