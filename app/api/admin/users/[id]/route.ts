import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, profileHandle: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const data: { displayName?: string; bio?: string; website?: string; profileHandle?: string } = {};

  if (typeof body?.displayName === "string") {
    const displayName = body.displayName.trim().slice(0, 60);
    if (!displayName) return NextResponse.json({ error: "Display name cannot be empty." }, { status: 400 });
    data.displayName = displayName;
  }

  if (typeof body?.bio === "string") {
    data.bio = body.bio.trim().slice(0, 500);
  }

  if (typeof body?.website === "string") {
    data.website = body.website.trim().slice(0, 200);
  }

  if (typeof body?.profileHandle === "string") {
    const profileHandle = body.profileHandle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
    if (!profileHandle) return NextResponse.json({ error: "Profile handle cannot be empty." }, { status: 400 });
    if (profileHandle !== target.profileHandle) {
      const taken = await prisma.user.findUnique({ where: { profileHandle } });
      if (taken) return NextResponse.json({ error: "That profile handle is already taken." }, { status: 409 });
    }
    data.profileHandle = profileHandle;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, displayName: true, bio: true, website: true, profileHandle: true },
  });

  await prisma.moderationAction.create({
    data: {
      actorId: admin.id,
      action: "user_edited",
      targetType: "user",
      targetId: id,
      metadata: data,
    },
  });

  return NextResponse.json({ user: updated });
}