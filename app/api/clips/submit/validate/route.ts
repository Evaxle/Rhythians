import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const { tagIds, storagePath } = body as { tagIds?: string[]; storagePath?: string };

  if (!storagePath) {
    return NextResponse.json({ error: "Video upload missing." }, { status: 400 });
  }

  const tags = await prisma.tag.findMany({ where: { id: { in: tagIds ?? [] } } });
  if ((tagIds ?? []).length !== tags.length) {
    return NextResponse.json({ error: "One or more clip tags are invalid." }, { status: 400 });
  }

  return NextResponse.json({ valid: true });
}
