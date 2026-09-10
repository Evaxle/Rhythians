import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CATEGORIES = new Set(["Website", "Maps & Ranking", "Challenges", "Battles & Tournaments", "Desktop & RhythKit", "Other"]);

export async function GET(request: Request) {
  const user = await getSessionUser().catch(() => null);
  const sort = new URL(request.url).searchParams.get("sort") === "top" ? "top" : "newest";
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; body: string; category: string; status: string; createdAt: Date; username: string; displayName: string | null; profileHandle: string; votes: number; comments: number; voted: boolean }>>(
    `SELECT p."id",p."title",p."body",p."category",p."status",p."createdAt",u."username",u."displayName",u."profileHandle",
      (SELECT COUNT(*)::int FROM "SuggestionVote" v WHERE v."suggestionId"=p."id") AS "votes",
      (SELECT COUNT(*)::int FROM "SuggestionComment" c WHERE c."suggestionId"=p."id") AS "comments",
      EXISTS(SELECT 1 FROM "SuggestionVote" v2 WHERE v2."suggestionId"=p."id" AND v2."userId"=$1) AS "voted"
     FROM "SuggestionPost" p JOIN "User" u ON u."id"=p."authorId"
     ORDER BY ${sort === "top" ? `"votes" DESC,p."createdAt" DESC` : `p."createdAt" DESC`} LIMIT 200`,
    user?.id ?? "",
  );
  return NextResponse.json({ suggestions: rows.map((row) => ({ ...row, author: { username: row.username, displayName: row.displayName, profileHandle: row.profileHandle } })) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { title?: string; body?: string; category?: string } | null;
  const title = body?.title?.trim() ?? "";
  const text = body?.body?.trim() ?? "";
  const category = body?.category?.trim() ?? "";
  if (title.length < 3 || title.length > 120 || text.length < 5 || text.length > 4000 || !CATEGORIES.has(category)) return NextResponse.json({ error: "Enter a valid title, category, and suggestion." }, { status: 400 });
  await prisma.$executeRawUnsafe(`INSERT INTO "SuggestionPost" ("id","authorId","title","body","category","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,'open',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), user.id, title, text, category);
  return NextResponse.json({ ok: true }, { status: 201 });
}
