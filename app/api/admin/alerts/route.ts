import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

const alertPayloadSchema = z.object({
  title: z.string(),
  message: z.string(),
  url: z.string().nullable().optional(),
  allUsers: z.boolean().optional(),
  userIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !(await canAccessAdmin(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = alertPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid alert payload" }, { status: 400 });
  }

  const title = payload.data.title.trim();
  const message = payload.data.message.trim();
  const url = payload.data.url?.trim() || null;
  const allUsers = payload.data.allUsers ?? false;
  const userIds = [...new Set(payload.data.userIds?.map((id) => id.trim()).filter(Boolean) ?? [])];

  if (!title || !message) return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  if (!allUsers && userIds.length === 0) return NextResponse.json({ error: "Select at least one user or choose all users" }, { status: 400 });
  if (title.length > 120 || message.length > 1000 || (url && url.length > 500)) return NextResponse.json({ error: "Alert is too long" }, { status: 400 });

  const recipients = allUsers
    ? await prisma.user.findMany({ select: { id: true } })
    : await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });

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
