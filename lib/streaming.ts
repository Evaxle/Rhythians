import { prisma } from "@/lib/db";

async function twitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("Twitch integration is not configured yet.");
  const response = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: "client_credentials" }), cache: "no-store" });
  if (!response.ok) throw new Error("Twitch authentication failed.");
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Twitch authentication failed.");
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
      await prisma.$executeRawUnsafe(`UPDATE "StreamerAccount" SET "isLive"=$2,"liveUrl"=$3,"liveCheckedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, account.id, isLive, isLive ? account.profileUrl : null);
    }
  }
}

async function refreshTikTok(accounts: any[]) {
  if (!accounts.length) return;
  await prisma.$executeRawUnsafe(`UPDATE "StreamerAccount" SET "isLive"=FALSE,"liveUrl"=NULL,"liveCheckedAt"=CURRENT_TIMESTAMP WHERE verified=TRUE AND platform='tiktok'`);
}

export async function refreshLiveStreamers() {
  const accounts = await prisma.$queryRawUnsafe<any[]>(`SELECT id,platform,username,"profileUrl" FROM "StreamerAccount" WHERE verified=TRUE ORDER BY "liveCheckedAt" ASC NULLS FIRST LIMIT 500`);
  await Promise.allSettled([
    refreshTwitch(accounts.filter(account => account.platform === "twitch")),
    refreshTikTok(accounts.filter(account => account.platform === "tiktok")),
  ]);
  return getLiveStreamers(5);
}

export async function getLiveStreamers(limit = 5) {
  return prisma.$queryRawUnsafe<any[]>(`WITH live_users AS (
    SELECT u.id AS "userId",u."discordId",u.username AS "rhythiansUsername",u."displayName",u."profileHandle",u.avatar,u.rhp,
      (SELECT COUNT(*)::int+1 FROM "User" ranked WHERE ranked.rhp>u.rhp) AS "globalPosition"
    FROM "User" u
    WHERE EXISTS (SELECT 1 FROM "StreamerAccount" linked WHERE linked."userId"=u.id AND linked.verified=TRUE AND linked."isLive"=TRUE)
    ORDER BY u.rhp DESC,u.id LIMIT $1
  )
  SELECT sa.platform,sa.username,sa."profileUrl",sa."liveUrl",lu.* FROM live_users lu
  JOIN "StreamerAccount" sa ON sa."userId"=lu."userId" AND sa.verified=TRUE AND sa."isLive"=TRUE
  ORDER BY lu.rhp DESC,lu."userId",sa.platform`, limit);
}
