import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCategoryLeaderboard, isCategory } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  if (!isCategory(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const rows = await getCategoryLeaderboard(category);
  return NextResponse.json({ category, rows });
}
