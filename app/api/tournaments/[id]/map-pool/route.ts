import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { recommendTournamentMap, reportTournamentMap, tournamentPoolViewer, voteTournamentMap, type TournamentPoolStage } from "@/lib/tournament-map-pools";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  try { return NextResponse.json(await tournamentPoolViewer(id, user.id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load map pool." }, { status: 403 }); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { action?: string; mapId?: string; value?: number; reason?: string; mapUrl?: string; stage?: TournamentPoolStage } | null;
  try {
    if (body?.action === "vote" && body.mapId && (body.value === 1 || body.value === -1)) await voteTournamentMap(id, user.id, body.mapId, body.value);
    else if (body?.action === "report" && body.mapId) await reportTournamentMap(id, user.id, body.mapId, body.reason ?? "");
    else if (body?.action === "recommend" && body.mapUrl && (body.stage === "regular" || body.stage === "finals")) await recommendTournamentMap(id, user.id, body.mapUrl, body.stage);
    else return NextResponse.json({ error: "Invalid map-pool action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Map-pool action failed." }, { status: 400 }); }
}