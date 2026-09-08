import { randomInt, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

export type StreamPlatform = "twitch" | "tiktok";

export function parseStreamerProfile(platform: StreamPlatform, input: string) {
  const raw = input.trim();
  let url: URL;
  try { url = new URL(raw.startsWith("http") ? raw : `https://${raw}`); } catch { throw new Error("Enter a valid profile URL."); }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (platform === "twitch") {
    if (host !== "twitch.tv" && host !== "m.twitch.tv") throw new Error("Enter a Twitch profile URL.");
    const username = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    if (!username || !/^[a-z0-9_]{4,25}$/.test(username)) throw new Error("That Twitch profile URL is invalid.");
    return { username, profileUrl: `https://www.twitch.tv/${username}` };
  }
  if (host !== "tiktok.com" && host !== "m.tiktok.com") throw new Error("Enter a TikTok profile URL.");
  const username = url.pathname.split("/").find((part) => part.startsWith("@"))?.slice(1).toLowerCase();
  if (!username || !/^[a-z0-9._]{2,24}$/.test(username)) throw new Error("That TikTok profile URL is invalid.");
  return { username, profileUrl: `https://www.tiktok.com/@${username}` };
}

async function twitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("Twitch integration is not configured yet.");
  const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`, { method: "POST", cache: "no-store" });
  if (!response.ok) throw new Error("Twitch authentication failed.");
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Twitch authentication failed.");
  return { clientId, token: data.access_token };
}

async function twitchUser(username: string) {
  const auth = await twitchAppToken();
  const response = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, { headers: { "Client-Id": auth.clientId, Authorization: `Bearer ${auth.token}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Twitch profile lookup failed.");
  const data = await response.json() as { data?: Array<{ id: string; login: string; description: string }> };
  return { auth, user: data.data?.[0] ?? null };
}

export async function startStreamerVerification(userId: string, platform: StreamPlatform, input: string) {
  const parsed = parseStreamerProfile(platform, input);
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StreamerAccount" (id,"userId",platform,username,"profileUrl","verificationCode","verificationExpiresAt",verified,"isLive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,FALSE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("userId",platform) DO UPDATE SET username=EXCLUDED.username,"profileUrl"=EXCLUDED."profileUrl","verificationCode"=EXCLUDED."verificationCode","verificationExpiresAt"=EXCLUDED."verificationExpiresAt",verified=FALSE,"verifiedAt"=NULL,"isLive"=FALSE,"updatedAt"=CURRENT_TIMESTAMP`,
    randomUUID(), userId, platform, parsed.username, parsed.profileUrl, code, expiresAt,
  );
  return { ...parsed, code, expiresAt };
}

export async function checkStreamerVerification(userId: string, platform: StreamPlatform) {
  const account = (await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "StreamerAccount" WHERE "userId"=$1 AND platform=$2`, userId, platform))[0];
  if (!account?.verificationCode) throw new Error("Start verification first.");
  if (!account.verificationExpiresAt || new Date(account.verificationExpiresAt).getTime() < Date.now()) throw new Error("That verification code expired. Generate a new one.");
  let bio = "";
  if (platform === "twitch") {
    const result = await twitchUser(account.username);
    if (!result.user) throw new Error("Twitch profile not found.");
    bio = result.user.description ?? "";
  } else {
    throw new Error("TikTok does not provide public bio lookup for arbitrary profiles through its supported API. TikTok verification requires Login Kit authorization; profile-page scraping is intentionally not used because it is unreliable and can break without notice.");
  }
  const normalized = bio.replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (!normalized.includes(String(account.verificationCode))) throw new Error(`Code ${account.verificationCode} was not found in the ${platform === "twitch" ? "Twitch" : "TikTok"} bio yet.`);
  await prisma.$executeRawUnsafe(`UPDATE "StreamerAccount" SET verified=TRUE,"verifiedAt"=CURRENT_TIMESTAMP,"verificationCode"=NULL,"verificationExpiresAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, account.id);
  return { verified: true };
}

export async function refreshLiveStreamers() {
  const accounts = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "StreamerAccount" WHERE verified=TRUE ORDER BY "liveCheckedAt" ASC NULLS FIRST LIMIT 100`);
  const twitch = accounts.filter((account) => account.platform === "twitch");
  if (twitch.length) {
    try {
      const auth = await twitchAppToken();
      const params = new URLSearchParams();
      twitch.forEach((account) => params.append("user_login", account.username));
      const response = await fetch(`https://api.twitch.tv/helix/streams?${params}`, { headers: { "Client-Id": auth.clientId, Authorization: `Bearer ${auth.token}` }, cache: "no-store" });
      if (response.ok) {
        const payload = await response.json() as { data?: Array<{ user_login: string }> };
        const live = new Set((payload.data ?? []).map((stream) => stream.user_login.toLowerCase()));
        for (const account of twitch) await prisma.$executeRawUnsafe(`UPDATE "StreamerAccount" SET "isLive"=$2,"liveUrl"=$3,"liveCheckedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, account.id, live.has(account.username.toLowerCase()), live.has(account.username.toLowerCase()) ? account.profileUrl : null);
      }
    } catch {}
  }
  return getLiveStreamers();
}

export async function getLiveStreamers(limit = 5) {
  return prisma.$queryRawUnsafe<any[]>(`SELECT sa.platform,sa.username,sa."profileUrl",sa."liveUrl",u.id AS "userId",u.username AS "rhythiansUsername",u."displayName",u."profileHandle",u.avatar,u.rhp,(SELECT COUNT(*)::int+1 FROM "User" ranked WHERE ranked.rhp>u.rhp) AS "globalPosition" FROM "StreamerAccount" sa JOIN "User" u ON u.id=sa."userId" WHERE sa.verified=TRUE AND sa."isLive"=TRUE ORDER BY u.rhp DESC LIMIT $1`, limit);
}
