import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { fetchRhythiaProfile } from "@/lib/rhythia";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown; note?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action === "approve" || body?.action === "deny" ? body.action : "";
  if (!id || !action) return NextResponse.json({ error: "A request and action are required." }, { status: 400 });

  const requestRow = await prisma.rhythiaProfileRequest.findUnique({ where: { id }, include: { user: { select: { id: true, username: true, profileHandle: true } } } });
  if (!requestRow) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (requestRow.status !== "pending") return NextResponse.json({ error: "This request has already been resolved." }, { status: 409 });

  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : null;

  if (action === "deny") {
    await prisma.$transaction([
      prisma.rhythiaProfileRequest.update({ where: { id }, data: { status: "denied", adminNote: note || requestRow.adminNote, resolvedAt: new Date(), resolvedBy: admin.id } }),
      prisma.notification.create({ data: { userId: requestRow.userId, type: "moderation", title: "Rhythia verification denied", message: note ? `Your Rhythia verification request was denied: ${note}` : "Your Rhythia verification request was denied.", url: "/settings" } }),
    ]);
    return NextResponse.json({ ok: true, status: "denied" });
  }

  try {
    const profile = await fetchRhythiaProfile(requestRow.profileId);
    const { bio: _bio, ...profileData } = profile;
    await prisma.$transaction(async (tx) => {
      await tx.rhythiaProfile.upsert({
        where: { userId: requestRow.userId },
        create: { userId: requestRow.userId, profileUrl: requestRow.profileUrl, ...profileData },
        update: { profileUrl: requestRow.profileUrl, ...profileData, syncedAt: new Date() },
      });
      await tx.user.update({ where: { id: requestRow.userId }, data: { rhythiaVerified: true } });
      await tx.rhythiaProfileRequest.update({ where: { id }, data: { status: "approved", adminNote: note || requestRow.adminNote, resolvedAt: new Date(), resolvedBy: admin.id } });
      await tx.notification.create({ data: { userId: requestRow.userId, type: "moderation", title: "Rhythia verification approved", message: "Your Rhythia verification request was approved manually.", url: "/settings" } });
    });
    return NextResponse.json({ ok: true, status: "approved" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the Rhythia profile." }, { status: 502 });
  }
}
