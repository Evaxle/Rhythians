import { prisma } from "@/lib/db";
import { calculateStoredTotals } from "@/lib/rhythia-mode-points";

export async function reconcileStoredRhp(userId: string) {
  const [current, totals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { rhp: true } }),
    calculateStoredTotals(userId),
  ]);
  if (!current) return null;
  const nextRhp = Math.max(0, Math.round(totals.rhp));
  if (current.rhp !== nextRhp) await prisma.user.update({ where: { id: userId }, data: { rhp: nextRhp } });
  return { rhp: nextRhp, rpl: totals.rpl, rps: totals.rps, rpv: totals.rpv, changed: current.rhp !== nextRhp };
}

export async function reconcileAllStoredRhp() {
  const users = await prisma.user.findMany({ where: { NOT: { profileHandle: "rhythia-imports" } }, select: { id: true } });
  let changed = 0;
  for (const user of users) {
    const result = await reconcileStoredRhp(user.id);
    if (result?.changed) changed += 1;
  }
  return { checked: users.length, changed };
}
