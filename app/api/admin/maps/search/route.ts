import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ maps: [] });

  const maps = await prisma.challengeMap.findMany({
    where: {
      OR: [
        { id: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      artist: true,
      status: true,
      rating: true,
      requestedRating: true,
      isAutoImported: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    maps: maps.map((map) => ({
      ...map,
      createdAt: map.createdAt.toISOString(),
    })),
  });
}
