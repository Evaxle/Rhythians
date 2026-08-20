import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { title?: unknown; message?: unknown; url?: unknown; userIds?: unknown; allUsers?: unknown; setupUsers?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : null;
  const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((value): value is string => typeof value === "string") : [];
  const allUsers = body?.allUsers === true;
  const setupUsers = body?.setupUsers === true;

  if (!title && !setupUsers) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!message && !setupUsers) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (!allUsers && !setupUsers && userIds.length === 0) return NextResponse.json({ error: "Select at least one recipient" }, { status: 400 });
  if (title.length > 120 || message.length > 1000 || (url && url.length > 500)) return NextResponse.json({ error: "Alert is too long" }, { status: 400 });

  const recipients = setupUsers
    ? await prisma.user.findMany({ where: { userTags: { none: {} } }, select: { id: true } })
    : allUsers
      ? await prisma.user.findMany({ select: { id: true } })
      : await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });

  if (recipients.length === 0) return NextResponse.json({ error: setupUsers ? "No users currently need tag setup" : "No matching users found" }, { status: 400 });

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      type: "announcement" as const,
      title: setupUsers ? "Complete your Rhythians profile" : title,
      message: setupUsers ? "Join the Rhythians Discord if needed, then answer the questions to set up your profile tags." : message,
      url: setupUsers ? "/setup-tags" : url,
    })),
  });

  return NextResponse.json({ sent: recipients.length });
}
