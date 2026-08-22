import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { tagIds?: unknown } | null;
  const tagIds = Array.isArray(body?.tagIds) ? [...new Set(body.tagIds.filter((id): id is string => typeof id === "string"))] : [];
  if (tagIds.length > 3) return NextResponse.json({ error: "You can display up to 3 tags." }, { status: 400 });
  const owned = await prisma.userTag.findMany({ where: { userId: user.id, tagId: { in: tagIds } }, select: { tagId: true } });
  if (owned.length !== tagIds.length) return NextResponse.json({ error: "You can only display tags you own." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DELETE FROM "UserProfileTag" WHERE "userId" = $1', user.id);
    for (const [position, tagId] of tagIds.entries()) {
      await tx.$executeRawUnsafe('INSERT INTO "UserProfileTag" ("id", "userId", "tagId", "position") VALUES ($1, $2, $3, $4)', randomUUID(), user.id, tagId, position);
    }
  });
  return NextResponse.json({ success: true, tagIds });
}
