import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export type CompletionClipKind = "challenge" | "category";
export type CompletionClipFeedItem = { id: string; kind: CompletionClipKind; userId: string; username: string; profileHandle: string; category: string | null; level: number; mapName: string; status: string; reviewerNote: string | null; reviewerName: string | null; createdAt: Date; videoUrl: string | null; comments: Array<{ id: string; userId: string; username: string; profileHandle: string; body: string; createdAt: Date }> };

export async function ensureCompletionClipTables() {
  await prisma.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompletionClipStatus') THEN CREATE TYPE "CompletionClipStatus" AS ENUM ('pending','approved','rejected','hidden'); END IF; END $$;`);
  await prisma.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'CategoryType' AND e.enumlabel = 'vibro') THEN ALTER TYPE "CategoryType" ADD VALUE 'vibro'; END IF; END $$;`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CompletionClip" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"category" "CategoryType" NOT NULL,"level" INTEGER NOT NULL,"mapName" TEXT NOT NULL,"storagePath" TEXT NOT NULL,"status" "CompletionClipStatus" NOT NULL DEFAULT 'pending',"reviewedById" TEXT,"reviewedAt" TIMESTAMP(3),"reviewerNote" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CompletionClip_pkey" PRIMARY KEY ("id"),CONSTRAINT "CompletionClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,CONSTRAINT "CompletionClip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChallengeCompletionClip" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"level" INTEGER NOT NULL,"mapName" TEXT NOT NULL,"storagePath" TEXT NOT NULL,"status" "CompletionClipStatus" NOT NULL DEFAULT 'pending',"reviewedById" TEXT,"reviewedAt" TIMESTAMP(3),"reviewerNote" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ChallengeCompletionClip_pkey" PRIMARY KEY ("id"),CONSTRAINT "ChallengeCompletionClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,CONSTRAINT "ChallengeCompletionClip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CompletionClipComment" ("id" TEXT NOT NULL,"kind" TEXT NOT NULL,"clipId" TEXT NOT NULL,"userId" TEXT NOT NULL,"body" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "CompletionClipComment_pkey" PRIMARY KEY ("id"),CONSTRAINT "CompletionClipComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CompletionClip_status_createdAt_idx" ON "CompletionClip"("status","createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CompletionClip_userId_category_level_idx" ON "CompletionClip"("userId","category","level")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChallengeCompletionClip_status_createdAt_idx" ON "ChallengeCompletionClip"("status","createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChallengeCompletionClip_userId_level_idx" ON "ChallengeCompletionClip"("userId","level")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CompletionClipComment_clip_idx" ON "CompletionClipComment"("kind","clipId","createdAt")`);
}

export async function getCompletionClipFeed(filters: { kind?: CompletionClipKind; category?: string; level?: number; approvedOnly?: boolean; limit?: number } = {}): Promise<CompletionClipFeedItem[]> {
  await ensureCompletionClipTables();
  const limit = Math.min(100, Math.max(1, filters.limit ?? 60));
  const rows: Array<{ id: string; kind: CompletionClipKind; userId: string; username: string; profileHandle: string; category: string | null; level: number; mapName: string; storagePath: string; status: string; reviewerNote: string | null; reviewerName: string | null; createdAt: Date }> = [];
  if (!filters.kind || filters.kind === "challenge") {
    const challenge = await prisma.$queryRawUnsafe<Array<Omit<(typeof rows)[number], "kind" | "category">>>(`SELECT c."id",c."userId",u."username",u."profileHandle",c."level",c."mapName",c."storagePath",c."status"::text AS "status",c."reviewerNote",COALESCE(r."displayName",r."username") AS "reviewerName",c."createdAt" FROM "ChallengeCompletionClip" c INNER JOIN "User" u ON u."id"=c."userId" LEFT JOIN "User" r ON r."id"=c."reviewedById" WHERE c."status" <> 'hidden' AND ($1::boolean = false OR c."status" = 'approved') AND ($2::integer IS NULL OR c."level"=$2) ORDER BY c."createdAt" DESC LIMIT $3`, Boolean(filters.approvedOnly), filters.level ?? null, limit);
    rows.push(...challenge.map((row) => ({ ...row, kind: "challenge" as const, category: null })));
  }
  if (!filters.kind || filters.kind === "category") {
    const category = await prisma.$queryRawUnsafe<Array<Omit<(typeof rows)[number], "kind">>>(`SELECT c."id",c."userId",u."username",u."profileHandle",c."category"::text AS "category",c."level",c."mapName",c."storagePath",c."status"::text AS "status",c."reviewerNote",COALESCE(r."displayName",r."username") AS "reviewerName",c."createdAt" FROM "CompletionClip" c INNER JOIN "User" u ON u."id"=c."userId" LEFT JOIN "User" r ON r."id"=c."reviewedById" WHERE c."status" <> 'hidden' AND ($1::boolean = false OR c."status" = 'approved') AND ($2::text IS NULL OR c."category"::text=$2) AND ($3::integer IS NULL OR c."level"=$3) ORDER BY c."createdAt" DESC LIMIT $4`, Boolean(filters.approvedOnly), filters.category ?? null, filters.level ?? null, limit);
    rows.push(...category.map((row) => ({ ...row, kind: "category" as const })));
  }
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const selected = rows.slice(0, limit);
  const ids = selected.map((row) => row.id);
  const comments = ids.length ? await prisma.$queryRawUnsafe<Array<{ id: string; kind: string; clipId: string; userId: string; username: string; profileHandle: string; body: string; createdAt: Date }>>(`SELECT c."id",c."kind",c."clipId",c."userId",u."username",u."profileHandle",c."body",c."createdAt" FROM "CompletionClipComment" c INNER JOIN "User" u ON u."id"=c."userId" WHERE c."clipId"=ANY($1::text[]) ORDER BY c."createdAt" ASC`, ids) : [];
  const bucket = process.env.STORAGE_BUCKET ?? "media";
  const sign = async (path: string) => supabaseAdmin ? (await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600)).data?.signedUrl ?? null : null;
  return Promise.all(selected.map(async (row) => ({ ...row, videoUrl: await sign(row.storagePath), comments: comments.filter((comment) => comment.clipId === row.id && comment.kind === row.kind).map(({ kind: _kind, clipId: _clipId, ...comment }) => comment) })));
}

export async function addCompletionClipComment(kind: CompletionClipKind, clipId: string, userId: string, body: string) {
  await ensureCompletionClipTables();
  const value = body.trim().slice(0, 1000);
  if (!value) throw new Error("Comment cannot be empty.");
  const table = kind === "challenge" ? "ChallengeCompletionClip" : "CompletionClip";
  const exists = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "${table}" WHERE "id"=$1 AND "status" <> 'hidden' LIMIT 1`, clipId);
  if (!exists[0]) throw new Error("Clip not found.");
  const id = randomUUID();
  await prisma.$executeRawUnsafe(`INSERT INTO "CompletionClipComment" ("id","kind","clipId","userId","body","createdAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)`, id, kind, clipId, userId, value);
  return { id, body: value };
}
