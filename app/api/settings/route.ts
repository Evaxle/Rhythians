import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAvatarUrl } from "@/lib/avatar";
import { getSessionUser } from "@/lib/auth";
import { fetchRhythiaProfile } from "@/lib/rhythia";
import { syncAutomaticPlayerClassification } from "@/lib/player-classification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const RANK_REFRESH_MS = 30_000;

function isExternalVideo(value: string) {
  if (!/^https?:\/\//i.test(value)) return false;
  return !/\/storage\/v1\/object\/(public|sign|authenticated)\//i.test(value);
}

async function refreshShowcaseRanks() {
  const profiles = await prisma.$queryRawUnsafe<Array<{ userId: string; profileId: number; syncedAt: Date | null }>>(`SELECT DISTINCT rp."userId",rp."profileId",rp."syncedAt" FROM "SettingsShowcase" s JOIN "RhythiaProfile" rp ON rp."userId"=s."userId"`);
  const stale = profiles.filter((profile) => !profile.syncedAt || Date.now() - new Date(profile.syncedAt).getTime() >= RANK_REFRESH_MS);
  for (const linked of stale.slice(0, 30)) {
    try {
      const profile = await fetchRhythiaProfile(linked.profileId);
      const { bio: _bio, ...profileData } = profile;
      await prisma.$transaction(async (tx) => {
        await tx.rhythiaProfile.update({ where: { userId: linked.userId }, data: { ...profileData, syncedAt: new Date() } });
        await syncAutomaticPlayerClassification(tx, linked.userId, profile.globalRank, null);
      });
    } catch {}
  }
}

export async function GET() {
  const currentUser = await getSessionUser().catch(() => null);
  await refreshShowcaseRanks().catch(() => undefined);
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string; cameraMode: string; userId: string; settingsFileUrl: string; settingsFileName: string; videoUrl: string; title: string | null; description: string | null; username: string; displayName: string | null; profileHandle: string; avatar: string | null; discordId: string | null; rhp: number; profileUsername: string | null; profileUrl: string | null; globalRank: number | null; country: string | null; flag: string | null; rhythianRank: string | null; rhythianRankColor: string | null; rhythiansGlobalRank: number;
  }>>(`SELECT s."id",s."cameraMode",s."userId",s."settingsFileUrl",s."settingsFileName",s."videoUrl",s."title",s."description",u."username",u."displayName",u."profileHandle",u."avatar",u."discordId",u."rhp",rp."username" AS "profileUsername",rp."profileUrl",rp."globalRank",rp."country",rp."flag",pr."name" AS "rhythianRank",pr."color" AS "rhythianRankColor",(SELECT COUNT(*) + 1 FROM "User" higher WHERE higher."rhp" > u."rhp" AND higher."profileHandle" <> 'rhythia-imports')::INTEGER AS "rhythiansGlobalRank" FROM "SettingsShowcase" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u."id" LEFT JOIN "PlayerRank" pr ON pr."id"=u."playerRankId" WHERE u."profileHandle" <> 'rhythia-imports' ORDER BY s."cameraMode",COALESCE(rp."globalRank",2147483647),s."createdAt" ASC`);

  return NextResponse.json({
    settings: rows.map((row) => ({
      ...row,
      canEdit: currentUser?.id === row.userId,
      avatar: getAvatarUrl({ avatar: row.avatar, discordId: row.discordId }, 256),
      settingsFileUrl: `/api/settings/${encodeURIComponent(row.id)}/download`,
      videoUrl: row.videoUrl ? (isExternalVideo(row.videoUrl) ? row.videoUrl : `/api/settings/${encodeURIComponent(row.id)}/video`) : null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
