import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listTournamentChat, sendTournamentChat } from "@/lib/tournament-runtime";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await listTournamentChat(id, user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load tournament chat." }, { status: 403 });
  }
}

export async function POST(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  if (!body || typeof body.content !== "string") return NextResponse.json({ error: "Message required." }, { status: 400 });
  try {
    return NextResponse.json(await sendTournamentChat(id, user.id, body.content));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send tournament message." }, { status: 400 });
  }
}
