import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { isRankedMap } from "@/lib/rhythkit-api";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const rankedOnly = url.searchParams.get("ranked") === "1";
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
      reviewerNote: true,
      requestedRating: true,
      isAutoImported: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: rankedOnly ? 100 : 50,
  });

  const filtered = rankedOnly ? maps.filter((map) => isRankedMap(map.rating, map.reviewerNote, String(map.status))) : maps;
  return NextResponse.json({
    maps: filtered.slice(0, 50).map(({ reviewerNote: _reviewerNote, ...map }) => ({
      ...map,
      createdAt: map.createdAt.toISOString(),
    })),
  });
}
