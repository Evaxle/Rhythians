import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getMapLeaderboard } from "@/lib/maps";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  const result = await getMapLeaderboard(id, user?.id);
  if (!result) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  return NextResponse.json(result);
}