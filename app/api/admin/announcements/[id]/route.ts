import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

function toSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string, excludeId: string) {
  const slug = toSlug(base) || "announcement";
  let candidate = slug;
  let suffix = 2;
  while (
    await prisma.announcement.findFirst({
      where: { slug: candidate, NOT: { id: excludeId } },
    })
  ) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    content?: unknown;
    published?: unknown;
    pinned?: unknown;
  } | null;

  const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = title.slice(0, 200);
    data.slug = await uniqueSlug(title, id);
  }
  if (typeof body?.content === "string") {
    const content = body.content.trim();
    if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });
    data.content = content.slice(0, 20000);
  }
  if (typeof body?.published === "boolean") data.published = body.published;
  if (typeof body?.pinned === "boolean") data.pinned = body.pinned;

  const announcement = await prisma.announcement.update({
    where: { id },
    data,
    select: { id: true, title: true, slug: true, published: true, pinned: true },
  });

  return NextResponse.json({ announcement });
}

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });

  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
