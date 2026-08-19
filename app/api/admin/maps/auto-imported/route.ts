import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { ensureChallengeLevelTable } from "@/lib/challenge";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await canAccessAdmin(admin))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  await ensureChallengeLevelTable();

  const result = await prisma.$transaction(async (tx) => {
    const removedAssignments = await tx.$executeRawUnsafe(
      'DELETE FROM "ChallengeMapLevel" WHERE "challengeMapId" IN (SELECT "id" FROM "ChallengeMap" WHERE "isAutoImported" = true)',
    );
    const removedMaps = await tx.challengeMap.deleteMany({ where: { isAutoImported: true } });
    const removedCategoryMaps = await tx.categoryMap.deleteMany({ where: { submittedBy: { profileHandle: "rhythia-imports" } } });
    return { removedAssignments, removedMaps: removedMaps.count, removedCategoryMaps: removedCategoryMaps.count };
  });

  return NextResponse.json(result);
}
