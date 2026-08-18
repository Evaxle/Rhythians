import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessAdmin(sessionUser))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requests = await prisma.rhythiaProfileRequest.findMany({
    include: {
      user: { select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true } },
      resolvedByUser: { select: { id: true, username: true, discriminator: true, profileHandle: true, avatar: true } },
    },
  });

  const rank: Record<string, number> = { pending: 0, approved: 1, denied: 2 };
  requests.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.createdAt.getTime() - a.createdAt.getTime()));

  return NextResponse.json({
    requests: requests.map((request) => ({
      id: request.id,
      profileId: request.profileId,
      profileUrl: request.profileUrl,
      rhythiaUsername: request.rhythiaUsername,
      claimedUsername: request.claimedUsername,
      status: request.status,
      adminNote: request.adminNote,
      createdAt: request.createdAt.toISOString(),
      resolvedAt: request.resolvedAt?.toISOString() ?? null,
      resolvedBy: request.resolvedByUser,
      user: request.user,
    })),
  });
}
