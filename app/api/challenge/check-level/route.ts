import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkChallengeLevel } from "@/lib/challenge";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await request.json().catch(() => null) as { level?: unknown } | null;
  const level = Number(body?.level);
  try {
    return NextResponse.json(await checkChallengeLevel(user.id, level));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check this level." }, { status: 400 });
  }
}
