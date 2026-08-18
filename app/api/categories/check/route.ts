import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardCategoryMap } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const profile = await prisma.rhythiaProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Link your Rhythia account to participate in categories." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const categoryMapId = typeof body?.categoryMapId === "string" ? body.categoryMapId : null;
  if (!categoryMapId) return NextResponse.json({ error: "Map id is required." }, { status: 400 });

  const result = await checkAndAwardCategoryMap(user.id, categoryMapId);
  return NextResponse.json(result);
}
