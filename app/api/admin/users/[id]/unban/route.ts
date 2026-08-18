import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Props) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (!user.isSuspended) return NextResponse.json({ error: "This user is not banned." }, { status: 400 });

  await prisma.user.update({ where: { id: user.id }, data: { isSuspended: false } });

  await prisma.moderationAction.create({
    data: {
      actorId: admin.id,
      action: "user_unbanned",
      targetType: "user",
      targetId: user.id,
      metadata: { username: user.username },
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "moderation",
      title: "You have been unbanned",
      message: "Your account has been reinstated. You can sign in again.",
      url: "/",
    },
  });

  return NextResponse.json({ success: true });
}
