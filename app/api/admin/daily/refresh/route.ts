import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { refreshTodayDailyMap } from "@/lib/daily";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  let rankIndex: number | null = typeof body?.rankIndex === "number" ? Math.floor(body.rankIndex) : null;

  // If a dailyMapId was given, resolve its rank so we refresh the correct rank's daily map.
  if (rankIndex == null && typeof body?.dailyMapId === "string") {
    const map = await prisma.dailyMap.findUnique({ where: { id: body.dailyMapId }, select: { rankIndex: true } });
    if (map) rankIndex = map.rankIndex;
  }
  if (rankIndex == null) rankIndex = 0;

  const { map, replaced } = await refreshTodayDailyMap(rankIndex);
  return NextResponse.json({
    replaced,
    rankIndex,
    map: {
      id: map.id,
      title: map.title,
      starRating: map.starRating,
      date: map.date.toISOString().slice(0, 10),
      downloadUrl: map.downloadUrl,
    },
  });
}