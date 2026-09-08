import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser, isOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setUserPointOverride, syncUserModeScores } from "@/lib/rhythia-mode-points";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const owner = await getSessionUser();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(owner)) return NextResponse.json({ error: "Only the site owner can edit user profiles from profile pages." }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, profileHandle: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const data: { username?: string; displayName?: string | null; profileHandle?: string; bio?: string; website?: string } = {};

  if (typeof body.username === "string") {
    const username = body.username.trim().slice(0, 60);
    if (!username) return NextResponse.json({ error: "Username cannot be empty." }, { status: 400 });
    data.username = username;
  }
  if (typeof body.displayName === "string") data.displayName = body.displayName.trim().slice(0, 60) || null;
  if (typeof body.bio === "string") data.bio = body.bio.trim().slice(0, 500);
  if (typeof body.website === "string") data.website = body.website.trim().slice(0, 200);
  if (typeof body.profileHandle === "string") {
    const profileHandle = body.profileHandle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
    if (!profileHandle) return NextResponse.json({ error: "Profile handle cannot be empty." }, { status: 400 });
    if (profileHandle !== target.profileHandle) {
      const taken = await prisma.user.findUnique({ where: { profileHandle }, select: { id: true } });
      if (taken && taken.id !== id) return NextResponse.json({ error: "That profile handle is already taken." }, { status: 409 });
    }
    data.profileHandle = profileHandle;
  }

  let updatedRhp: number | undefined;
  if (body.rhp !== undefined && body.rhp !== null && body.rhp !== "") {
    const rhp = Number(body.rhp);
    if (!Number.isFinite(rhp) || rhp < 0 || rhp > 1_000_000) return NextResponse.json({ error: "RHP must be between 0 and 1,000,000." }, { status: 400 });
    await setUserPointOverride(id, "rhp", Math.round(rhp));
    updatedRhp = (await syncUserModeScores(id)).rhp;
  }

  if (Object.keys(data).length > 0) await prisma.user.update({ where: { id }, data });

  if (body.title !== undefined || body.titleColor !== undefined || body.titleNeon !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 40) : "";
    const color = typeof body.titleColor === "string" ? body.titleColor.trim() : "#a78bfa";
    const neon = body.titleNeon === true;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return NextResponse.json({ error: "Title color must be a 6-digit hex color." }, { status: 400 });
    if (!title) {
      await prisma.$executeRawUnsafe('DELETE FROM "UserProfileTitle" WHERE "userId"=$1', id);
    } else {
      await prisma.$executeRawUnsafe(
        'INSERT INTO "UserProfileTitle" ("id","userId","title","color","neon","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "title"=EXCLUDED."title","color"=EXCLUDED."color","neon"=EXCLUDED."neon","updatedAt"=CURRENT_TIMESTAMP',
        randomUUID(), id, title, color, neon,
      );
    }
  }

  await prisma.moderationAction.create({
    data: {
      actorId: owner.id,
      action: "owner_profile_inline_edited",
      targetType: "user",
      targetId: id,
      metadata: { ...data, rhp: updatedRhp, title: body.title, titleColor: body.titleColor, titleNeon: body.titleNeon },
    },
  });

  const updated = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, displayName: true, profileHandle: true, bio: true, website: true, rhp: true } });
  return NextResponse.json({ ok: true, user: updated });
}
