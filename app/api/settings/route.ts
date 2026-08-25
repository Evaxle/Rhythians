import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; cameraMode: string; userId: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string; title: string | null; description: string | null; username: string; displayName: string | null; profileHandle: string; avatar: string | null; rhp: number; globalRank: number; rhythianRank: string | null; rhythianRankColor: string | null }>>(`SELECT s."id",s."cameraMode",s."userId",s."settingsFileUrl",s."settingsFileName",s."videoUrl",s."title",s."description",u."username",u."displayName",u."profileHandle",u."avatar",u."rhp",(SELECT COUNT(*) + 1 FROM "User" higher WHERE higher."rhp" > u."rhp" AND higher."profileHandle" <> 'rhythia-imports')::INTEGER AS "globalRank",pr."name" AS "rhythianRank",pr."color" AS "rhythianRankColor" FROM "SettingsShowcase" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "PlayerRank" pr ON pr."id"=u."playerRankId" WHERE u."profileHandle" <> 'rhythia-imports' ORDER BY "globalRank" ASC,s."createdAt" ASC`);
  return NextResponse.json({ settings: rows });
}
