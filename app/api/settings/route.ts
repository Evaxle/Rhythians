import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; cameraMode: string; userId: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string; title: string | null; description: string | null; username: string; displayName: string | null; profileHandle: string; avatar: string | null; globalRank: number | null; profileUrl: string; rhp: number; rhythianRank: string | null; rhythianRankColor: string | null }>>(`SELECT s."id",s."cameraMode",s."userId",s."settingsFileUrl",s."settingsFileName",s."videoUrl",s."title",s."description",u."username",u."displayName",u."profileHandle",u."avatar",u."rhp",rp."globalRank",rp."profileUrl",pr."name" AS "rhythianRank",pr."color" AS "rhythianRankColor" FROM "SettingsShowcase" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u."id" LEFT JOIN "PlayerRank" pr ON pr."id"=u."playerRankId" ORDER BY COALESCE(rp."globalRank",2147483647) ASC,s."createdAt" ASC`);
  return NextResponse.json({ settings: rows });
}
