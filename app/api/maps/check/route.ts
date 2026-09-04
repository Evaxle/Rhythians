import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MODE_RULES, syncUserModeScores, type ModeKey } from "@/lib/rhythia-mode-points";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to participate in ranked maps." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const mapId = typeof body?.mapId === "string" ? body.mapId : null;
  if (!mapId) return NextResponse.json({ error: "Map id is required." }, { status: 400 });
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, title: true, status: true, rating: true } });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  const sync = await syncUserModeScores(user.id);
  const mapKey = map.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const matching = sync.rows.filter((row) => row.mapTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === mapKey);
  const modes = matching.map((row) => ({ mode: row.cameraMode as ModeKey, label: MODE_RULES[row.cameraMode as ModeKey].label, short: MODE_RULES[row.cameraMode as ModeKey].short, points: row.points, accuracy: row.accuracy }));
  return NextResponse.json({ status: modes.length > 0 ? "beat" : "not_beat", mapId: map.id, title: map.title, points: modes.reduce((sum, entry) => sum + entry.points, 0), modes, rhp: sync.rhp, rpl: sync.rpl, rps: sync.rps, rpv: sync.rpv });
}
