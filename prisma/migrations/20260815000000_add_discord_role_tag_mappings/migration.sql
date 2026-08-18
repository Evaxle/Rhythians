-- Discord role to tag sync support.

-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('discord', 'manual');

-- AlterTable
ALTER TABLE "UserTag" ADD COLUMN "source" "TagSource" NOT NULL DEFAULT 'discord';

-- CreateTable
CREATE TABLE "DiscordRoleTagMapping" (
    "id" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordRoleTagMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordRoleTagMapping_discordRoleId_key" ON "DiscordRoleTagMapping"("discordRoleId");

-- AddForeignKey
ALTER TABLE "DiscordRoleTagMapping" ADD CONSTRAINT "DiscordRoleTagMapping_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
