import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRankedMapLeaderboard } from "@/lib/ranked-map-leaderboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const rankParam = url.searchParams.get("rank");
  const selectedRank = rankParam == null || rankParam === "all" || rankParam === "-1" ? null : Number(rankParam);
  if (selectedRank != null && (!Number.isInteger(selectedRank) || selectedRank < 0 || selectedRank > 8)) {
    return NextResponse.json({ error: "Invalid rank selection." }, { status: 400 });
  }

  const result = await getRankedMapLeaderboard(id, selectedRank);
  if (!result) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  return NextResponse.json(result);
}
