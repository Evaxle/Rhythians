import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !(await canAccessAdmin(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : null;
  const allUsers = body.allUsers === true;
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((id: unknown): id is string => typeof id === "string") : [];

  if (!title || !message) return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  if (!allUsers && userIds.length === 0) return NextResponse.json({ error: "Select at least one user or choose all users" }, { status: 400 });
  if (title.length > 120 || message.length > 1000 || (url && url.length > 500)) return NextResponse.json({ error: "Alert is too long" }, { status: 400 });

  const recipients = allUsers
    ? await prisma.user.findMany({ select: { id: true } })
    : await prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true } });

  if (recipients.length === 0) return NextResponse.json({ error: "No matching users found" }, { status: 400 });

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      type: "announcement",
      title,
      message,
      url,
    })),
  });

  return NextResponse.json({ sent: recipients.length });
}
