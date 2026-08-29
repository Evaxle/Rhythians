import { prisma } from "@/lib/db";
import { syncRhythiaMaps } from "@/lib/rhythia-map-sync";

type RhythiaMapStatus = "RANKED" | "UNRANKED" | "LEGACY";
const UNRANKED_MARKER = "rhythia-unranked";
const UNMATCHED_MARKER = "rhythia-auto-review-unmatched";

export async function syncAndAutoReviewRhythiaMaps(status?: RhythiaMapStatus) {
  const result = await syncRhythiaMaps(status);
  const importer = await prisma.user.findFirst({ where: { profileHandle: "rhythia-imports" }, select: { id: true } });
  if (!importer) throw new Error("The rhythia-imports system user does not exist.");

  const unranked = await prisma.challengeMap.updateMany({
    where: { isAutoImported: true, status: "approved", reviewerNote: UNRANKED_MARKER },
    data: { status: "rejected", reviewedById: importer.id, reviewedAt: new Date() },
  });

  let unmatched = { count: 0 };
  if (!status) {
    unmatched = await prisma.challengeMap.updateMany({
      where: { isAutoImported: true, status: "pending" },
      data: { status: "rejected", reviewerNote: UNMATCHED_MARKER, reviewedById: importer.id, reviewedAt: new Date() },
    });
  }

  return { ...result, autoRejected: unranked.count + unmatched.count };
}
