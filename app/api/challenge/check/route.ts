import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkAndAwardChallengeLevelMap } from "@/lib/challenge";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.challengeMapId !== "string") return NextResponse.json({ error: "A challenge map is required." }, { status: 400 });
  try {
    return NextResponse.json(await checkAndAwardChallengeLevelMap(user.id, body.challengeMapId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check your challenge score." }, { status: 400 });
  }
}
