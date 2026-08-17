import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";

type Props = { params: Promise<{ id: string; completionId: string }> };

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!(await canAccessAdmin(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, completionId } = await params;

  const completion = await prisma.challengeMapCompletion.findUnique({
    where: { id: completionId },
    include: { challengeMap: { select: { id: true, title: true } }, user: { select: { id: true, username: true, rhp: true } } },
  });
  if (!completion || completion.challengeMapId !== id) {
    return NextResponse.json({ error: "Completion not found." }, { status: 404 });
  }

  // Remove the completion and claw back the RHP the user earned from it (without going below 0).
  const rhpToClaw = completion.passed ? completion.points : Math.abs(completion.points);
  const newRhp = Math.max(0, (completion.user.rhp ?? 0) - rhpToClaw);

  await prisma.$transaction([
    prisma.challengeMapCompletion.delete({ where: { id: completionId } }),
    prisma.user.update({ where: { id: completion.userId }, data: { rhp: newRhp } }),
    prisma.rhpTransaction.create({
      data: {
        userId: completion.userId,
        amount: -rhpToClaw,
        reason: "challenge_map_removed",
        description: `Score removed by admin from map: ${completion.challengeMap.title}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, clawedBack: rhpToClaw });
}