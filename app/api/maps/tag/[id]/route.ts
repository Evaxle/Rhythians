import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRankedMapDetail } from "@/lib/ranked-map-leaderboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const { id } = await params;
  const map = await getRankedMapDetail(id);
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  return NextResponse.json({ id: map.mapId, title: map.title });
}
