import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const maps = await prisma.challengeMap.findMany({ where: { isAutoImported: true, status: "pending" }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, artist: true, mapperName: true, mapFileUrl: true, imageUrl: true, requestedRating: true, noteCount: true, length: true, sourceUrl: true } });
  return NextResponse.json(maps);
}
