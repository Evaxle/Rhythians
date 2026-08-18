import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { refreshTodayDailyMap } from "@/lib/daily";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { map, replaced } = await refreshTodayDailyMap();
  return NextResponse.json({
    replaced,
    map: {
      id: map.id,
      title: map.title,
      starRating: map.starRating,
      date: map.date.toISOString().slice(0, 10),
      downloadUrl: map.downloadUrl,
    },
  });
}