import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardChallengeMap } from "@/lib/maps";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to participate in ranked maps." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const mapId = typeof body?.mapId === "string" ? body.mapId : null;
  if (!mapId) return NextResponse.json({ error: "Map id is required." }, { status: 400 });

  const result = await checkAndAwardChallengeMap(user.id, mapId);
  return NextResponse.json(result);
}