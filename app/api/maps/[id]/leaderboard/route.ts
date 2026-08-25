import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRankedMapLeaderboard } from "@/lib/ranked-map-leaderboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const { id } = await params;
  const result = await getRankedMapLeaderboard(id, null);
  if (!result) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  return NextResponse.json(result);
}
