import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { forfeitTournamentMatch, getTournamentPublicState, submitTournamentScore } from "@/lib/tournaments";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  const state = await getTournamentPublicState(id, user?.id ?? null);
  if (!state) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  return NextResponse.json(state);
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  try {
    if (body?.action === "check-score") return NextResponse.json({ ok: true, ...(await submitTournamentScore(id, user.id)) });
    if (body?.action === "forfeit") return NextResponse.json(await forfeitTournamentMatch(id, user.id));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tournament action failed." }, { status: 400 });
  }
}
