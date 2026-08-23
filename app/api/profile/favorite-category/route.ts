import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const categories = new Set(["jumps", "stream", "tech", "vibro", "off_grid"]);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const rows = await prisma.$queryRawUnsafe<Array<{ favoriteCategory: string | null }>>('SELECT "favoriteCategory" FROM "User" WHERE "id" = $1 LIMIT 1', user.id);
  return NextResponse.json({ category: rows[0]?.favoriteCategory ?? null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { category?: unknown } | null;
  const category = body?.category === null || body?.category === "" ? null : typeof body?.category === "string" ? body.category : null;
  if (category && !categories.has(category)) return NextResponse.json({ error: "Invalid favorite category." }, { status: 400 });
  await prisma.$executeRawUnsafe('UPDATE "User" SET "favoriteCategory" = $1 WHERE "id" = $2', category, user.id);
  return NextResponse.json({ success: true, category });
}
