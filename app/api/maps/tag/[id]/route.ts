import { NextResponse } from "next/server";
import { getRankedMapDetail } from "@/lib/ranked-map-leaderboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  const map = await getRankedMapDetail(id);
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  return NextResponse.json({ id: map.mapId, title: map.title });
}
