import { prisma } from "@/lib/db";
import { getAvatarUrl } from "@/lib/avatar";

let twitchTokenCache: { clientId: string; token: string; expiresAt: number } | null = null;

async function twitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("Twitch integration is not configured yet.");
  if (twitchTokenCache?.clientId === clientId && twitchTokenCache.expiresAt > Date.now() + 60_000) return { clientId, token: twitchTokenCache.token };
  const response = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: "client_credentials" }), cache: "no-store" });
  if (!response.ok) throw new Error("Twitch authentication failed.");
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Twitch authentication failed.");
  twitchTokenCache = { clientId, token: data.access_token, expiresAt: Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000 };
  return { clientId, token: data.access_token };
}

async function refreshTwitch(accounts: any[]) {
  if (!accounts.length) return;
  const auth = await twitchAppToken();
  for (let offset = 0; offset < accounts.length; offset += 100) {
    const batch = accounts.slice(offset, offset + 100);
    const params = new URLSearchParams();
    for (const account of batch) params.append("user_login", account.username);
    const response = await fetch(`https://api.twitch.tv/helix/streams?${params}`, { headers: { "Client-Id": auth.clientId, Authorization: `Bearer ${auth.token}` }, cache: "no-store" });
    if (!response.ok) throw new Error("Twitch live status lookup failed.");
    const payload = await response.json() as { data?: Array<{ user_login: string }> };
    const live = new Set((payload.data ?? []).map(stream => stream.user_login.toLowerCase()));
    for (const account of batch) {
      const isLive = live.has(String(account.username).toLowerCase());
      const liveUrl = isLive ? account.profileUrl : null;
      await prisma.$executeRawUnsafe(`UPDATE "StreamerAccount" SET "isLive"=$2,"liveUrl"=$3,"liveCheckedAt"=CURRENT_TIMESTAMP,"updatedAt"=CASE WHEN "isLive" IS DISTINCT FROM $2 OR "liveUrl" IS DISTINCT FROM $3 THEN CURRENT_TIMESTAMP ELSE "updatedAt" END WHERE id=$1`, account.id, isLive, liveUrl);
    }
  }
}

async function refreshTikTok(accounts: any[]) {
  if (!accounts.length) return;
  await prisma.$executeRawUnsafe(`UPDATE "StreamerAccount" SET "isLive"=FALSE,"liveUrl"=NULL,"liveCheckedAt"=CURRENT_TIMESTAMP,"updatedAt"=CASE WHEN "isLive"=TRUE OR "liveUrl" IS NOT NULL THEN CURRENT_TIMESTAMP ELSE "updatedAt" END WHERE verified=TRUE AND platform='tiktok' AND ("liveCheckedAt" IS NULL OR "liveCheckedAt" < CURRENT_TIMESTAMP - INTERVAL '1 minute')`);
}

export async function refreshLiveStreamers() {
  const accounts = await prisma.$queryRawUnsafe<any[]>(`SELECT id,platform,username,"profileUrl" FROM "StreamerAccount" WHERE verified=TRUE AND ("liveCheckedAt" IS NULL OR "liveCheckedAt" < CURRENT_TIMESTAMP - INTERVAL '30 seconds') ORDER BY "liveCheckedAt" ASC NULLS FIRST LIMIT 500`);
  if (accounts.length) await Promise.allSettled([
    refreshTwitch(accounts.filter(account => account.platform === "twitch")),
    refreshTikTok(accounts.filter(account => account.platform === "tiktok")),
  ]);
  return getLiveStreamers(5);
}

export async function getLiveStreamers(limit = 5) {
  const rows = await prisma.$queryRawUnsafe<Array<{
    platform: string;
    username: string;
    profileUrl: string;
    liveUrl: string | null;
    userId: string;
    discordId: string | null;
    rhythiansUsername: string;
    displayName: string | null;
    profileHandle: string;
    avatar: string | null;
    rhp: number;
    rhythiansGlobalRank: number;
    rhythiaUsername: string | null;
    rhythiaProfileUrl: string | null;
    rhythiaGlobalRank: number | null;
    playerRankName: string | null;
    playerRankColor: string | null;
  }>>(`WITH live_users AS (
    SELECT
      u.id AS "userId",
      u."discordId",
      u.username AS "rhythiansUsername",
      u."displayName",
      u."profileHandle",
      u.avatar,
      u.rhp,
      (SELECT COUNT(*)::int + 1 FROM "User" ranked WHERE ranked.rhp > u.rhp AND ranked."profileHandle" <> 'rhythia-imports') AS "rhythiansGlobalRank",
      rp.username AS "rhythiaUsername",
      rp."profileUrl" AS "rhythiaProfileUrl",
      rp."globalRank" AS "rhythiaGlobalRank",
      pr.name AS "playerRankName",
      pr.color AS "playerRankColor"
    FROM "User" u
    LEFT JOIN "RhythiaProfile" rp ON rp."userId" = u.id
    LEFT JOIN "PlayerRank" pr ON pr.id = u."playerRankId"
    WHERE u."profileHandle" <> 'rhythia-imports'
      AND EXISTS (SELECT 1 FROM "StreamerAccount" linked WHERE linked."userId" = u.id AND linked.verified = TRUE AND linked."isLive" = TRUE)
    ORDER BY u.rhp DESC, u.id
    LIMIT $1
  )
  SELECT sa.platform,sa.username,sa."profileUrl",sa."liveUrl",lu.* FROM live_users lu
  JOIN "StreamerAccount" sa ON sa."userId"=lu."userId" AND sa.verified=TRUE AND sa."isLive"=TRUE
  ORDER BY lu.rhp DESC,lu."userId",sa.platform`, limit);

  return rows.map((row) => ({
    ...row,
    avatar: getAvatarUrl({ avatar: row.avatar, discordId: row.discordId }, 128),
  }));
}
