import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isCategory } from "@/lib/category-constants";
import { checkCategoryLevel } from "@/lib/category-bulk-check";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await request.json().catch(() => null) as { category?: unknown; level?: unknown } | null;
  if (typeof body?.category !== "string" || !isCategory(body.category)) return NextResponse.json({ error: "Choose a valid category." }, { status: 400 });
  try {
    return NextResponse.json(await checkCategoryLevel(user.id, body.category, Number(body.level)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check this level." }, { status: 400 });
  }
}
