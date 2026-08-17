import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canAccessAdmin(sessionUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mappings = await prisma.discordRoleTagMapping.findMany({
    include: { tag: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    mappings: mappings.map((mapping) => ({
      id: mapping.id,
      discordRoleId: mapping.discordRoleId,
      tagId: mapping.tagId,
      tag: { id: mapping.tag.id, name: mapping.tag.name, slug: mapping.tag.slug },
      createdAt: mapping.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canAccessAdmin(sessionUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const discordRoleId: string = body.discordRoleId;
  const tagId: string = body.tagId;

  if (typeof discordRoleId !== "string" || discordRoleId.length === 0) {
    return NextResponse.json({ error: "discordRoleId is required" }, { status: 400 });
  }
  if (typeof tagId !== "string" || tagId.length === 0) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 400 });
  }

  const mapping = await prisma.discordRoleTagMapping.upsert({
    where: { discordRoleId },
    update: { tagId },
    create: { discordRoleId, tagId },
    include: { tag: true },
  });

  return NextResponse.json({ mapping });
}
