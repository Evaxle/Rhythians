import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const exists = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "SuggestionVote" WHERE "suggestionId"=$1 AND "userId"=$2 LIMIT 1`, id, user.id);
  if (exists[0]) await prisma.$executeRawUnsafe(`DELETE FROM "SuggestionVote" WHERE "suggestionId"=$1 AND "userId"=$2`, id, user.id);
  else await prisma.$executeRawUnsafe(`INSERT INTO "SuggestionVote" ("id","suggestionId","userId","createdAt") SELECT $1,$2,$3,CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM "SuggestionPost" WHERE "id"=$2)`, randomUUID(), id, user.id);
  return NextResponse.json({ ok: true, voted: !exists[0] });
}
