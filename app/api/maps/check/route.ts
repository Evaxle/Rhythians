import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MODE_RULES, syncUserModeScores, type ModeKey } from "@/lib/rhythia-mode-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeTitle(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { profileId: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to participate in ranked maps." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const mapId = typeof body?.mapId === "string" ? body.mapId : null;
  if (!mapId) return NextResponse.json({ error: "Map id is required." }, { status: 400 });
  const map = await prisma.challengeMap.findUnique({ where: { id: mapId }, select: { id: true, title: true, status: true, rating: true, sourceBeatmapId: true } });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  try {
    const sync = await syncUserModeScores(user.id);
    const expectedKey = map.sourceBeatmapId != null ? `rhythia:${map.sourceBeatmapId}` : `map:${map.id}`;
    const normalizedTitle = normalizeTitle(map.title);
    const matching = sync.rows.filter((row) => row.mapKey === expectedKey || normalizeTitle(row.mapTitle) === normalizedTitle);
    const modes = matching.map((row) => ({ mode: row.cameraMode as ModeKey, label: MODE_RULES[row.cameraMode as ModeKey].label, short: MODE_RULES[row.cameraMode as ModeKey].short, points: row.points, accuracy: row.accuracy }));
    return NextResponse.json({ status: modes.length > 0 ? "beat" : "not_beat", mapId: map.id, title: map.title, points: modes.reduce((sum, entry) => sum + entry.points, 0), modes, rhp: sync.rhp, rpl: sync.rpl, rps: sync.rps, rpv: sync.rpv });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check your Rhythia score." }, { status: 502 });
  }
}