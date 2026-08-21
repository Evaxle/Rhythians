import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { supabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { getUserChallengeLevel } from "@/lib/challenge";

async function authorize() {
  const user = await getSessionUser();
  if (!user || !(await canAccessAdmin(user))) return null;
  return user;
}

export async function GET() {
  const reviewer = await authorize();
  if (!reviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const categoryRows = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; username: string; category: string; level: number; mapName: string; storagePath: string; status: string; createdAt: Date }>>(`SELECT c."id", c."userId", u."username", c."category"::text AS "category", c."level", c."mapName", c."storagePath", c."status"::text AS "status", c."createdAt" FROM "CompletionClip" c INNER JOIN "User" u ON u."id" = c."userId" WHERE c."status" = 'pending' ORDER BY c."createdAt" ASC`);
  const challengeRows = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; username: string; level: number; mapName: string; storagePath: string; status: string; createdAt: Date }>>(`SELECT c."id", c."userId", u."username", c."level", c."mapName", c."storagePath", c."status"::text AS "status", c."createdAt" FROM "ChallengeCompletionClip" c INNER JOIN "User" u ON u."id" = c."userId" WHERE c."status" = 'pending' ORDER BY c."createdAt" ASC`);
  const bucket = process.env.STORAGE_BUCKET ?? "media";
  const sign = async (path: string) => supabaseAdmin ? (await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600)).data?.signedUrl ?? null : null;
  return NextResponse.json({ category: await Promise.all(categoryRows.map(async (row) => ({ ...row, videoUrl: await sign(row.storagePath) }))), challenge: await Promise.all(challengeRows.map(async (row) => ({ ...row, videoUrl: await sign(row.storagePath) }))) });
}

export async function PATCH(request: Request) {
  const reviewer = await authorize();
  if (!reviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { kind?: string; id?: string; decision?: string; note?: string } | null;
  if (!body?.id || !["approved", "rejected"].includes(body.decision ?? "")) return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  const kind = body.kind === "challenge" ? "challenge" : "category";
  const table = kind === "challenge" ? "ChallengeCompletionClip" : "CompletionClip";
  const row = await prisma.$queryRawUnsafe<Array<{ id: string; userId: string; category?: string; level: number; status: string }>>(`SELECT "id","userId","category"::text AS "category","level","status"::text AS "status" FROM "${table}" WHERE "id" = $1 LIMIT 1`, body.id);
  if (!row[0]) return NextResponse.json({ error: "Completion not found." }, { status: 404 });
  if (row[0].status !== "pending") return NextResponse.json({ error: "This completion has already been reviewed." }, { status: 409 });
  if (body.decision === "approved") {
    if (kind === "category") {
      const current = await prisma.$queryRawUnsafe<Array<{ level: number }>>(`SELECT "level" FROM "UserCategoryLevel" WHERE "userId" = $1 AND "category" = $2 LIMIT 1`, row[0].userId, row[0].category);
      if ((current[0]?.level ?? 0) !== row[0].level - 1) return NextResponse.json({ error: `User is no longer level ${row[0].level - 1} in this category.` }, { status: 409 });
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "CompletionClip" WHERE "userId" = $1 AND "category" = $2 AND "level" = $3 AND "status" = 'approved' LIMIT 1`, row[0].userId, row[0].category, row[0].level);
      if (existing[0]) return NextResponse.json({ error: "This user already has this category level approved." }, { status: 409 });
      await prisma.$executeRawUnsafe(`INSERT INTO "UserCategoryLevel" ("id","userId","category","level","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT ("userId","category") DO UPDATE SET "level" = EXCLUDED."level", "updatedAt" = CURRENT_TIMESTAMP`, randomUUID(), row[0].userId, row[0].category, row[0].level);
    } else {
      const current = await getUserChallengeLevel(row[0].userId);
      if (current !== row[0].level - 1) return NextResponse.json({ error: `User is no longer level ${row[0].level - 1} in Challenge.` }, { status: 409 });
      await prisma.$executeRawUnsafe(`DELETE FROM "UserChallengeLevelOverride" WHERE "userId" = $1`, row[0].userId);
      await prisma.$executeRawUnsafe(`INSERT INTO "UserChallengeLevelOverride" ("id","userId","level","createdAt","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), row[0].userId, row[0].level);
    }
  }
  await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "status" = $1::"CompletionClipStatus", "reviewedById" = $2, "reviewedAt" = CURRENT_TIMESTAMP, "reviewerNote" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $4`, body.decision, reviewer.id, body.note?.trim() || null, body.id);
  return NextResponse.json({ ok: true, status: body.decision });
}
