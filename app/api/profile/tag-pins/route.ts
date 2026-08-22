import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const setting = await prisma.siteSetting.findUnique({ where: { key: `profile.pinned-tags.${user.id}` }, select: { value: true } });
  let pinnedTagSlugs: string[] = [];
  try {
    const parsed = setting ? JSON.parse(setting.value) : [];
    pinnedTagSlugs = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, 3) : [];
  } catch {}
  return NextResponse.json({ pinnedTagSlugs });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const pinnedTagSlugs = Array.isArray(body?.pinnedTagSlugs) ? body.pinnedTagSlugs.filter((value: unknown): value is string => typeof value === "string").slice(0, 3) : [];
  const tags = await prisma.tag.findMany({ where: { slug: { in: pinnedTagSlugs } }, select: { slug: true } });
  const allowed = tags.map((tag) => tag.slug);
  await prisma.siteSetting.upsert({ where: { key: `profile.pinned-tags.${user.id}` }, create: { key: `profile.pinned-tags.${user.id}`, value: JSON.stringify(allowed), description: "Profile tags pinned for public identity displays" }, update: { value: JSON.stringify(allowed) } });
  return NextResponse.json({ pinnedTagSlugs: allowed });
}
