import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ discordRoleId: string }> }
) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canAccessAdmin(sessionUser))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { discordRoleId } = await params;

  await prisma.discordRoleTagMapping.deleteMany({
    where: { discordRoleId },
  });

  return NextResponse.json({ success: true });
}
