import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ warnings: [] });
  }

  const warnings = await prisma.userWarning.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { username: true, displayName: true } } },
  });

  return NextResponse.json({
    warnings: warnings.map((warning) => ({
      id: warning.id,
      reason: warning.reason,
      createdAt: warning.createdAt.toISOString(),
      actor: warning.actor.displayName ?? warning.actor.username,
    })),
  });
}