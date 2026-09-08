import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { getAvatarUrl } from "@/lib/avatar";

export const dynamic = "force-dynamic";

const bucket = () => process.env.STORAGE_BUCKET ?? "media";

function storagePath(value: string) {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const url = new URL(value);
    const markers = [
      `/storage/v1/object/public/${bucket()}/`,
      `/storage/v1/object/sign/${bucket()}/`,
      `/storage/v1/object/authenticated/${bucket()}/`,
    ];
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);
      if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {}
  return null;
}

async function signedVideoUrl(value: string) {
  if (!supabaseAdmin) return /^https?:\/\//i.test(value) ? value : null;
  const path = storagePath(value);
  if (!path) return /^https?:\/\//i.test(value) ? value : null;
  const { data, error } = await supabaseAdmin.storage.from(bucket()).createSignedUrl(path, 60 * 60);
  return error || !data ? null : data.signedUrl;
}

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    cameraMode: string;
    userId: string;
    settingsFileUrl: string;
    settingsFileName: string;
    videoUrl: string;
    title: string | null;
    description: string | null;
    username: string;
    displayName: string | null;
    profileHandle: string;
    avatar: string | null;
    discordId: string | null;
    rhp: number;
    profileUsername: string | null;
    profileUrl: string | null;
    globalRank: number | null;
    country: string | null;
    flag: string | null;
    rhythianRank: string | null;
    rhythianRankColor: string | null;
    rhythiansGlobalRank: number;
  }>>(`SELECT s."id",s."cameraMode",s."userId",s."settingsFileUrl",s."settingsFileName",s."videoUrl",s."title",s."description",u."username",u."displayName",u."profileHandle",u."avatar",u."discordId",u."rhp",rp."username" AS "profileUsername",rp."profileUrl",rp."globalRank",rp."country",rp."flag",pr."name" AS "rhythianRank",pr."color" AS "rhythianRankColor",(SELECT COUNT(*) + 1 FROM "User" higher WHERE higher."rhp" > u."rhp" AND higher."profileHandle" <> 'rhythia-imports')::INTEGER AS "rhythiansGlobalRank" FROM "SettingsShowcase" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "RhythiaProfile" rp ON rp."userId"=u."id" LEFT JOIN "PlayerRank" pr ON pr."id"=u."playerRankId" WHERE u."profileHandle" <> 'rhythia-imports' ORDER BY s."cameraMode",COALESCE(rp."globalRank",2147483647),s."createdAt" ASC`);

  const settings = await Promise.all(rows.map(async (row) => ({
    ...row,
    avatar: getAvatarUrl({ avatar: row.avatar, discordId: row.discordId }, 256),
    settingsFileUrl: `/api/settings/${encodeURIComponent(row.id)}/download`,
    videoUrl: await signedVideoUrl(row.videoUrl),
  })));

  return NextResponse.json({ settings });
}
