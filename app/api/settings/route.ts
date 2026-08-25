import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "lock" && mode !== "spin") return NextResponse.json({ error: "Invalid settings mode." }, { status: 400 });
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; cameraMode: string; userId: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string; title: string | null; description: string | null; username: string; displayName: string | null; profileHandle: string; avatar: string | null; globalRank: number | null; profileUrl: string }>>(`SELECT s."id",s."cameraMode",s."userId",s."settingsFileUrl",s."settingsFileName",s."videoUrl",s."title",s."description",u."username",u."displayName",u."profileHandle",u."avatar",rp."globalRank",rp."profileUrl" FROM "SettingsShowcase" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u."id" WHERE s."cameraMode"=$1 ORDER BY COALESCE(rp."globalRank",2147483647) ASC,s."createdAt" ASC`, mode);
  return NextResponse.json({ settings: rows });
}