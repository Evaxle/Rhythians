import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const maps = await prisma.challengeMap.findMany({
    where: {
      status: "approved",
      ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { artist: { contains: query, mode: "insensitive" } }, { mapperName: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ title: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: { id: true, title: true, artist: true, rating: true, mapperName: true },
  });

  return NextResponse.json({ maps });
}
