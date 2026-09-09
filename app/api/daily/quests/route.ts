import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { claimDailyModeQuest, getDailyModeQuests } from "@/lib/daily-mode-quests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const quests = await getDailyModeQuests(user.id, true);
    return NextResponse.json({ quests }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check daily quests." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { questId?: unknown } | null;
  if (typeof body?.questId !== "string" || !body.questId) return NextResponse.json({ error: "Quest ID is required." }, { status: 400 });
  try {
    const result = await claimDailyModeQuest(user.id, body.questId);
    const quests = await getDailyModeQuests(user.id, false);
    return NextResponse.json({ ok: true, ...result, quests });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to claim daily quest." }, { status: 400 });
  }
}
