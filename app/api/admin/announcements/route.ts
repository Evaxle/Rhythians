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

async function uniqueSlug(base: string, excludeId?: string) {
  const slug = toSlug(base) || "announcement";
  let candidate = slug;
  let suffix = 2;
  while (
    await prisma.announcement.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    })
  ) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    content?: unknown;
    published?: unknown;
    pinned?: unknown;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });

  const announcement = await prisma.announcement.create({
    data: {
      title: title.slice(0, 200),
      slug: await uniqueSlug(title),
      content: content.slice(0, 20000),
      published: body?.published === true,
      pinned: body?.pinned === true,
      authorId: user.id,
    },
    select: { id: true, title: true, slug: true, published: true, pinned: true },
  });

  return NextResponse.json({ announcement }, { status: 201 });
}
