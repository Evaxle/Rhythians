import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; body: string; createdAt: Date; username: string; displayName: string | null; profileHandle: string }>>(`SELECT c."id",c."body",c."createdAt",u."username",u."displayName",u."profileHandle" FROM "SuggestionComment" c JOIN "User" u ON u."id"=c."authorId" WHERE c."suggestionId"=$1 ORDER BY c."createdAt" ASC LIMIT 300`, id);
  return NextResponse.json({ comments: rows.map((row) => ({ ...row, author: { username: row.username, displayName: row.displayName, profileHandle: row.profileHandle } })) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const data = await request.json().catch(() => null) as { body?: string } | null;
  const body = data?.body?.trim() ?? "";
  if (!body || body.length > 1500) return NextResponse.json({ error: "Comment must be 1–1500 characters." }, { status: 400 });
  const commentId = randomUUID();
  const inserted = await prisma.$executeRawUnsafe(`INSERT INTO "SuggestionComment" ("id","suggestionId","authorId","body","createdAt","updatedAt") SELECT $1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM "SuggestionPost" WHERE "id"=$2)`, commentId, id, user.id, body);
  if (!inserted) return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  return NextResponse.json({ comment: { id: commentId, body, createdAt: new Date().toISOString(), author: { username: user.username, displayName: user.displayName, profileHandle: user.profileHandle } } }, { status: 201 });
}
