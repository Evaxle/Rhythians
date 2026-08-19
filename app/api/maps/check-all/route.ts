import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkAllRankedMaps } from "@/lib/ranked-map-check";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  try {
    const result = await checkAllRankedMaps(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check your scores." }, { status: 400 });
  }
}
