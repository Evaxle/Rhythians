import { prisma } from "@/lib/db";

export async function withKickedSignupsExcluded<T>(tournamentId: string, operation: () => Promise<T>) {
  const kicked = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "TournamentSignup" WHERE "tournamentId"=$1 AND status='kicked'`,
    tournamentId,
  );
  if (!kicked.length) return operation();
  const ids = kicked.map((row) => row.id);
  await prisma.$executeRawUnsafe(
    `UPDATE "TournamentSignup" SET status='withdrawn',"updatedAt"=CURRENT_TIMESTAMP WHERE id=ANY($1::text[]) AND status='kicked'`,
    ids,
  );
  try {
    return await operation();
  } finally {
    await prisma.$executeRawUnsafe(
      `UPDATE "TournamentSignup" SET status='kicked',"updatedAt"=CURRENT_TIMESTAMP WHERE id=ANY($1::text[]) AND status='withdrawn'`,
      ids,
    );
  }
}
