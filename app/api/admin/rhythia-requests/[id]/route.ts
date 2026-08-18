import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { fetchRhythiaProfile } from "@/lib/rhythia";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: unknown; message?: unknown } | null;
  const action = body?.action;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1000) : "";

  if (!["approve", "deny"].includes(action as string)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const requestRecord = await prisma.rhythiaProfileRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, profileHandle: true } } },
  });
  if (!requestRecord) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (requestRecord.status !== "pending") return NextResponse.json({ error: "This request has already been handled." }, { status: 400 });

  const now = new Date();

  if (action === "approve") {
    let profileData;
    try {
      profileData = await fetchRhythiaProfile(requestRecord.profileId);
    } catch {
      return NextResponse.json({ error: "Couldn't load that Rhythia profile to link it. Try again." }, { status: 502 });
    }

    const alreadyLinked = await prisma.rhythiaProfile.findUnique({
      where: { profileId: requestRecord.profileId },
      select: { userId: true },
    });
    if (alreadyLinked && alreadyLinked.userId !== requestRecord.userId) {
      return NextResponse.json(
        { error: "That Rhythia profile is already linked to a different account." },
        { status: 409 }
      );
    }

    await prisma.rhythiaProfile.upsert({
      where: { userId: requestRecord.userId },
      create: { userId: requestRecord.userId, profileUrl: requestRecord.profileUrl, ...profileData },
      update: { profileUrl: requestRecord.profileUrl, ...profileData, syncedAt: now },
    });
    await prisma.rhythiaProfileRequest.update({
      where: { id },
      data: { status: "approved", adminNote: message || null, resolvedAt: now, resolvedBy: admin.id },
    });
    await prisma.notification.create({
      data: {
        userId: requestRecord.userId,
        type: "moderation",
        title: "Rhythia profile approved",
        message: message || "Your Rhythia profile has been approved and linked to your account.",
        url: `/profile/${requestRecord.user.profileHandle}`,
      },
    });
  } else {
    await prisma.rhythiaProfileRequest.update({
      where: { id },
      data: { status: "denied", adminNote: message || null, resolvedAt: now, resolvedBy: admin.id },
    });
    await prisma.notification.create({
      data: {
        userId: requestRecord.userId,
        type: "moderation",
        title: "Rhythia profile link request denied",
        message: message || "Your request to link that Rhythia profile was denied.",
        url: `/profile/${requestRecord.user.profileHandle}`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
