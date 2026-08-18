import { NextResponse } from "next/server";
import { Client } from "pg";

// One-time schema repair: applies every migration's DDL idempotently so a
// database that was bootstrapped before the migrations were run can be healed
// without local DB access. Call once: /api/admin/db-repair?secret=<SETUP_SECRET>
//
// NOTE: This does NOT run data-migration UPDATEs (e.g. backfilling
// rhythiaVerified) or baseline seeds. For a fully correct result prefer
// `npm run db:migrate`. This endpoint is a safe recovery net.

const REPAIR_STATEMENTS: string[] = [
  // --- enums ---
  `DO $$ BEGIN CREATE TYPE "ConversationType" AS ENUM ('direct', 'group'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "FriendRequestStatus" AS ENUM ('pending', 'accepted', 'declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "TagSource" AS ENUM ('discord', 'manual', 'onboarding'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TYPE "TagSource" ADD VALUE IF NOT EXISTS 'onboarding'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "CameraMode" AS ENUM ('lock', 'spin', 'vr'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "RhythiaProfileRequestStatus" AS ENUM ('pending', 'approved', 'denied'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "ChallengeMapStatus" AS ENUM ('pending', 'approved', 'rejected', 'hidden'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "CategoryType" AS ENUM ('jumps', 'stream', 'tech', 'off_grid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "CategoryMapStatus" AS ENUM ('pending', 'approved', 'rejected', 'hidden'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'rhp_earned'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'map_approved'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'map_rejected'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'rank_change'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // --- User columns ---
  `ALTER TABLE "User" ALTER COLUMN "discordId" DROP NOT NULL`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inGuild" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mutedUntil" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rhp" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avgMapRating" DOUBLE PRECISION`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scoreImportDone" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dailyStreak" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastDailyBeatAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastRhythiaRpCheckAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rhythiaVerified" BOOLEAN NOT NULL DEFAULT false`,

  // --- Clip columns ---
  `ALTER TABLE "Clip" ALTER COLUMN "categoryId" DROP NOT NULL`,
  `ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "featuredOrder" INTEGER`,
  `ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "cameraMode" "CameraMode"`,
  `ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT`,
  `ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`,
  `ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "songName" TEXT`,

  // --- UserTag source ---
  `ALTER TABLE "UserTag" ADD COLUMN IF NOT EXISTS "source" "TagSource" NOT NULL DEFAULT 'discord'`,

  // --- RhythiaProfile status cache ---
  `ALTER TABLE "RhythiaProfile" ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN`,
  `ALTER TABLE "RhythiaProfile" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3)`,
  `ALTER TABLE "RhythiaProfile" ADD COLUMN IF NOT EXISTS "statusCheckedAt" TIMESTAMP(3)`,

  // --- Messaging ---
  `CREATE TABLE IF NOT EXISTS "Conversation" ("id" TEXT NOT NULL, "type" "ConversationType" NOT NULL DEFAULT 'direct', "name" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "ConversationMember" ("id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'member', "lastReadAt" TIMESTAMP(3), "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "Message" ("id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "content" TEXT NOT NULL, "isEdited" BOOLEAN NOT NULL DEFAULT false, "isDeleted" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Message_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "Conversation_createdById_idx" ON "Conversation"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "ConversationMember_userId_idx" ON "ConversationMember"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt")`,

  // --- Friends ---
  `CREATE TABLE IF NOT EXISTS "FriendRequest" ("id" TEXT NOT NULL, "senderId" TEXT NOT NULL, "receiverId" TEXT NOT NULL, "status" "FriendRequestStatus" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "respondedAt" TIMESTAMP(3), CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "FriendRequest_receiverId_idx" ON "FriendRequest"("receiverId")`,
  `CREATE INDEX IF NOT EXISTS "FriendRequest_senderId_idx" ON "FriendRequest"("senderId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FriendRequest_senderId_receiverId_key" ON "FriendRequest"("senderId", "receiverId")`,

  // --- Discord role tag mapping ---
  `CREATE TABLE IF NOT EXISTS "DiscordRoleTagMapping" ("id" TEXT NOT NULL, "discordRoleId" TEXT NOT NULL, "tagId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "DiscordRoleTagMapping_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DiscordRoleTagMapping_discordRoleId_key" ON "DiscordRoleTagMapping"("discordRoleId")`,

  // --- Rhythia profiles + requests ---
  `CREATE TABLE IF NOT EXISTS "RhythiaProfile" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "profileId" INTEGER NOT NULL, "profileUrl" TEXT NOT NULL, "username" TEXT, "country" TEXT, "flag" TEXT, "globalRank" INTEGER, "countryRank" INTEGER, "rhythmPoints" DOUBLE PRECISION, "title" TEXT NOT NULL, "scores" JSONB NOT NULL, "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RhythiaProfile_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RhythiaProfile_userId_key" ON "RhythiaProfile"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RhythiaProfile_profileId_key" ON "RhythiaProfile"("profileId")`,
  `CREATE TABLE IF NOT EXISTS "RhythiaProfileRequest" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "profileId" INTEGER NOT NULL, "profileUrl" TEXT NOT NULL, "rhythiaUsername" TEXT NOT NULL, "claimedUsername" TEXT NOT NULL, "status" "RhythiaProfileRequestStatus" NOT NULL DEFAULT 'pending', "adminNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "resolvedBy" TEXT, CONSTRAINT "RhythiaProfileRequest_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "RhythiaProfileRequest_status_idx" ON "RhythiaProfileRequest"("status")`,

  // --- Warnings / moderation ---
  `CREATE TABLE IF NOT EXISTS "UserWarning" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserWarning_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "UserWarning_userId_idx" ON "UserWarning"("userId")`,

  // --- Daily maps + RHP ---
  `CREATE TABLE IF NOT EXISTS "DailyMap" ("id" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "beatmapId" INTEGER NOT NULL, "title" TEXT NOT NULL, "artist" TEXT, "difficulty" INTEGER, "starRating" DOUBLE PRECISION NOT NULL, "noteCount" INTEGER, "length" INTEGER, "playcount" INTEGER, "mapHash" TEXT, "downloadUrl" TEXT NOT NULL, "imageUrl" TEXT, "mapperName" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DailyMap_pkey" PRIMARY KEY ("id"))`,
  `ALTER TABLE "DailyMap" ADD COLUMN IF NOT EXISTS "rankIndex" INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS "DailyMap_date_idx" ON "DailyMap"("date")`,
  `CREATE INDEX IF NOT EXISTS "DailyMap_rankIndex_idx" ON "DailyMap"("rankIndex")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyMap_date_rankIndex_key" ON "DailyMap"("date", "rankIndex")`,
  `CREATE TABLE IF NOT EXISTS "DailyMapBeat" ("id" TEXT NOT NULL, "dailyMapId" TEXT NOT NULL, "userId" TEXT NOT NULL, "points" INTEGER NOT NULL, "scoreId" INTEGER, "accuracy" DOUBLE PRECISION, "misses" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DailyMapBeat_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyMapBeat_dailyMapId_userId_key" ON "DailyMapBeat"("dailyMapId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "DailyMapBeat_userId_idx" ON "DailyMapBeat"("userId")`,
  `CREATE TABLE IF NOT EXISTS "RhpTransaction" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "reason" TEXT NOT NULL, "description" TEXT, "dailyMapBeatId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RhpTransaction_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "RhpTransaction_userId_idx" ON "RhpTransaction"("userId")`,
  `CREATE INDEX IF NOT EXISTS "RhpTransaction_createdAt_idx" ON "RhpTransaction"("createdAt")`,

  // --- Challenge maps ---
  `CREATE TABLE IF NOT EXISTS "ChallengeMap" ("id" TEXT NOT NULL, "title" TEXT NOT NULL, "artist" TEXT, "description" TEXT, "mapFileUrl" TEXT NOT NULL, "imageUrl" TEXT, "requestedRating" DOUBLE PRECISION NOT NULL, "rating" DOUBLE PRECISION, "mapperName" TEXT, "noteCount" INTEGER, "length" INTEGER, "submittedById" TEXT NOT NULL, "status" "ChallengeMapStatus" NOT NULL DEFAULT 'pending', "reviewerNote" TEXT, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChallengeMap_pkey" PRIMARY KEY ("id"))`,
  `ALTER TABLE "ChallengeMap" ADD COLUMN IF NOT EXISTS "sourceBeatmapId" INTEGER`,
  `ALTER TABLE "ChallengeMap" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT`,
  `ALTER TABLE "ChallengeMap" ADD COLUMN IF NOT EXISTS "isAutoImported" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "ChallengeMap_status_idx" ON "ChallengeMap"("status")`,
  `CREATE INDEX IF NOT EXISTS "ChallengeMap_rating_idx" ON "ChallengeMap"("rating")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeMap_sourceBeatmapId_key" ON "ChallengeMap"("sourceBeatmapId")`,
  `CREATE TABLE IF NOT EXISTS "ChallengeMapCompletion" ("id" TEXT NOT NULL, "challengeMapId" TEXT NOT NULL, "userId" TEXT NOT NULL, "rating" DOUBLE PRECISION NOT NULL, "accuracy" DOUBLE PRECISION, "passed" BOOLEAN NOT NULL, "points" INTEGER NOT NULL, "scoreId" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChallengeMapCompletion_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeMapCompletion_challengeMapId_userId_key" ON "ChallengeMapCompletion"("challengeMapId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "ChallengeMapCompletion_userId_idx" ON "ChallengeMapCompletion"("userId")`,

  // --- Categories ---
  `CREATE TABLE IF NOT EXISTS "CategoryMap" ("id" TEXT NOT NULL, "category" "CategoryType" NOT NULL, "level" INTEGER NOT NULL, "title" TEXT NOT NULL, "artist" TEXT, "description" TEXT, "mapFileUrl" TEXT NOT NULL, "imageUrl" TEXT, "mapperName" TEXT, "noteCount" INTEGER, "length" INTEGER, "sourceBeatmapId" INTEGER, "sourceUrl" TEXT, "submittedById" TEXT NOT NULL, "status" "CategoryMapStatus" NOT NULL DEFAULT 'pending', "reviewerNote" TEXT, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CategoryMap_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CategoryMap_sourceBeatmapId_key" ON "CategoryMap"("sourceBeatmapId")`,
  `CREATE INDEX IF NOT EXISTS "CategoryMap_category_level_idx" ON "CategoryMap"("category", "level")`,
  `CREATE INDEX IF NOT EXISTS "CategoryMap_status_idx" ON "CategoryMap"("status")`,
  `CREATE TABLE IF NOT EXISTS "CategoryMapCompletion" ("id" TEXT NOT NULL, "categoryMapId" TEXT NOT NULL, "userId" TEXT NOT NULL, "passed" BOOLEAN NOT NULL, "accuracy" DOUBLE PRECISION, "scoreId" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CategoryMapCompletion_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CategoryMapCompletion_categoryMapId_userId_key" ON "CategoryMapCompletion"("categoryMapId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "CategoryMapCompletion_userId_idx" ON "CategoryMapCompletion"("userId")`,
  `CREATE TABLE IF NOT EXISTS "UserCategoryLevel" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "category" "CategoryType" NOT NULL, "level" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UserCategoryLevel_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserCategoryLevel_userId_category_key" ON "UserCategoryLevel"("userId", "category")`,

  // --- content indexes ---
  `CREATE INDEX IF NOT EXISTS "Comment_clipId_createdAt_idx" ON "Comment"("clipId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read")`,
  `CREATE INDEX IF NOT EXISTS "Clip_reviewedById_idx" ON "Clip"("reviewedById")`,
];

const FOREIGN_KEYS: string[] = [
  `ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "DiscordRoleTagMapping" ADD CONSTRAINT "DiscordRoleTagMapping_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "RhythiaProfile" ADD CONSTRAINT "RhythiaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "RhythiaProfileRequest" ADD CONSTRAINT "RhythiaProfileRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "RhythiaProfileRequest" ADD CONSTRAINT "RhythiaProfileRequest_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "DailyMapBeat" ADD CONSTRAINT "DailyMapBeat_dailyMapId_fkey" FOREIGN KEY ("dailyMapId") REFERENCES "DailyMap"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "DailyMapBeat" ADD CONSTRAINT "DailyMapBeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "RhpTransaction" ADD CONSTRAINT "RhpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "ChallengeMap" ADD CONSTRAINT "ChallengeMap_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "ChallengeMap" ADD CONSTRAINT "ChallengeMap_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "ChallengeMapCompletion" ADD CONSTRAINT "ChallengeMapCompletion_challengeMapId_fkey" FOREIGN KEY ("challengeMapId") REFERENCES "ChallengeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "ChallengeMapCompletion" ADD CONSTRAINT "ChallengeMapCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "CategoryMap" ADD CONSTRAINT "CategoryMap_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "CategoryMap" ADD CONSTRAINT "CategoryMap_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "CategoryMapCompletion" ADD CONSTRAINT "CategoryMapCompletion_categoryMapId_fkey" FOREIGN KEY ("categoryMapId") REFERENCES "CategoryMap"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "CategoryMapCompletion" ADD CONSTRAINT "CategoryMapCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "UserCategoryLevel" ADD CONSTRAINT "UserCategoryLevel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "Clip" ADD CONSTRAINT "Clip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "SETUP_SECRET is not configured." }, { status: 503 });
  }
  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  const errors: Array<{ statement: string; error: string }> = [];
  let applied = 0;

  try {
    await client.connect();

    for (const statement of REPAIR_STATEMENTS) {
      try {
        await client.query(statement);
        applied++;
      } catch (err) {
        errors.push({ statement: statement.slice(0, 80), error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Foreign keys may already exist; add only if missing.
    for (const fk of FOREIGN_KEYS) {
      try {
        await client.query(fk);
        applied++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/already exists|duplicate/i.test(message)) {
          errors.push({ statement: fk.slice(0, 80), error: message });
        }
      }
    }

    // Data backfill: verified flag for anyone with a linked Rhythia profile.
    try {
      await client.query(`UPDATE "User" SET "rhythiaVerified" = true WHERE id IN (SELECT "userId" FROM "RhythiaProfile")`);
    } catch (err) {
      errors.push({ statement: "backfill rhythiaVerified", error: err instanceof Error ? err.message : String(err) });
    }

    // Ensure every user has a level-0 row in each category (the profile and
    // category helpers expect these to exist; everyone starts at level 0).
    try {
      await client.query(`
        INSERT INTO "UserCategoryLevel" ("id", "userId", "category", "level", "updatedAt")
        SELECT gen_random_uuid()::text, u."id", c."category", 0, NOW()
        FROM "User" u
        CROSS JOIN (VALUES ('jumps'), ('stream'), ('tech'), ('off_grid')) AS c("category")
        WHERE NOT EXISTS (
          SELECT 1 FROM "UserCategoryLevel" ucl
          WHERE ucl."userId" = u."id" AND ucl."category" = c."category"
        )
      `);
    } catch (err) {
      errors.push({ statement: "backfill UserCategoryLevel", error: err instanceof Error ? err.message : String(err) });
    }

    // Make sure the owner account is never left in a suspended/banned state.
    try {
      if (process.env.OWNER_DISCORD_ID) {
        await client.query(
          `UPDATE "User" SET "isSuspended" = false, "suspendedUntil" = NULL, "mutedUntil" = NULL WHERE "discordId" = $1`,
          [process.env.OWNER_DISCORD_ID]
        );
      }
    } catch (err) {
      errors.push({ statement: "owner unsuspend", error: err instanceof Error ? err.message : String(err) });
    }

    return NextResponse.json({ success: errors.length === 0, applied, errors });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}
