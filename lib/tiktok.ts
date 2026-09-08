import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { decryptStreamerToken, encryptStreamerToken } from "@/lib/stream-token-crypto";

const TIKTOK_AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_API = "https://open.tiktokapis.com/v2";
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.profile", "video.list"];

function config() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  const redirectUri = (process.env.TIKTOK_REDIRECT_URI ?? "https://rhythians.vercel.app/api/profile/streaming/tiktok/callback").trim();
  if (!clientKey || !clientSecret) throw new Error("TikTok integration is not configured yet.");
  return { clientKey, clientSecret, redirectUri };
}

export function createTikTokAuthorization() {
  const { clientKey, redirectUri } = config();
  const state = randomBytes(32).toString("base64url");
  const url = new URL(TIKTOK_AUTHORIZE);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return { state, url: url.toString() };
}

type TokenPayload = { access_token: string; expires_in: number; open_id: string; refresh_expires_in: number; refresh_token: string; scope: string; token_type: string };
type TikTokError = { error?: string; error_description?: string; log_id?: string };

function errorMessage(data: TikTokError | null, fallback: string) {
  const detail = data?.error_description?.trim() || data?.error?.trim() || fallback;
  return data?.log_id ? `${detail} (TikTok log ID: ${data.log_id})` : detail;
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch(TIKTOK_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store" });
  const data = await response.json().catch(() => null) as (TokenPayload & TikTokError) | null;
  if (!response.ok || !data?.access_token) throw new Error(errorMessage(data, "TikTok token exchange failed."));
  return data;
}

export async function exchangeTikTokCode(code: string) {
  const { clientKey, clientSecret, redirectUri } = config();
  return tokenRequest(new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }));
}

async function refreshTikTokToken(refreshToken: string) {
  const { clientKey, clientSecret } = config();
  return tokenRequest(new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }));
}

function apiError(payload: any, fallback: string) {
  const error = payload?.error;
  if (!error || !error.code || error.code === "ok") return null;
  const detail = String(error.message || error.code || fallback).trim() || fallback;
  return error.log_id ? `${detail} (TikTok log ID: ${error.log_id})` : detail;
}

export async function getTikTokUser(accessToken: string) {
  const fields = "open_id,avatar_url,display_name,profile_deep_link,bio_description,is_verified,username";
  const response = await fetch(`${TIKTOK_API}/user/info/?fields=${encodeURIComponent(fields)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await response.json().catch(() => null) as any;
  const failure = apiError(payload, "TikTok profile lookup failed.");
  if (!response.ok || failure) throw new Error(failure ?? `TikTok profile lookup failed (${response.status}).`);
  return payload?.data?.user;
}

export async function saveTikTokAccount(userId: string, tokens: TokenPayload) {
  const profile = await getTikTokUser(tokens.access_token);
  if (!profile?.open_id) throw new Error("TikTok did not return an account identifier.");
  const username = String(profile.username || profile.display_name || "tiktok-user").replace(/^@/, "").slice(0, 64);
  const profileUrl = profile.profile_deep_link || (profile.username ? `https://www.tiktok.com/@${profile.username}` : "https://www.tiktok.com/");
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StreamerAccount" (id,"userId",platform,username,"profileUrl","providerAccountId","accessToken","refreshToken","tokenExpiresAt","refreshExpiresAt",scopes,verified,"verifiedAt","isLive","createdAt","updatedAt") VALUES ($1,$2,'tiktok',$3,$4,$5,$6,$7,$8,$9,$10,TRUE,CURRENT_TIMESTAMP,FALSE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("userId",platform) DO UPDATE SET username=EXCLUDED.username,"profileUrl"=EXCLUDED."profileUrl","providerAccountId"=EXCLUDED."providerAccountId","accessToken"=EXCLUDED."accessToken","refreshToken"=EXCLUDED."refreshToken","tokenExpiresAt"=EXCLUDED."tokenExpiresAt","refreshExpiresAt"=EXCLUDED."refreshExpiresAt",scopes=EXCLUDED.scopes,verified=TRUE,"verifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
    randomUUID(), userId, username, profileUrl, profile.open_id, encryptStreamerToken(tokens.access_token), encryptStreamerToken(tokens.refresh_token), new Date(Date.now() + tokens.expires_in * 1000), new Date(Date.now() + tokens.refresh_expires_in * 1000), tokens.scope,
  );
}

async function accessTokenFor(userId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT id,"accessToken","refreshToken","tokenExpiresAt" FROM "StreamerAccount" WHERE "userId"=$1 AND platform='tiktok' AND verified=TRUE`, userId);
  const account = rows[0];
  if (!account?.accessToken || !account?.refreshToken) throw new Error("Connect TikTok first.");
  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() > Date.now() + 60_000) return decryptStreamerToken(account.accessToken);
  const refreshed = await refreshTikTokToken(decryptStreamerToken(account.refreshToken));
  await prisma.$executeRawUnsafe(`UPDATE "StreamerAccount" SET "accessToken"=$2,"refreshToken"=$3,"tokenExpiresAt"=$4,"refreshExpiresAt"=$5,scopes=$6,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, account.id, encryptStreamerToken(refreshed.access_token), encryptStreamerToken(refreshed.refresh_token), new Date(Date.now() + refreshed.expires_in * 1000), new Date(Date.now() + refreshed.refresh_expires_in * 1000), refreshed.scope);
  return refreshed.access_token;
}

export async function listTikTokVideos(userId: string) {
  const token = await accessTokenFor(userId);
  const fields = "id,title,video_description,duration,cover_image_url,embed_link,share_url,create_time";
  const response = await fetch(`${TIKTOK_API}/video/list/?fields=${encodeURIComponent(fields)}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ max_count: 20 }), cache: "no-store" });
  const payload = await response.json().catch(() => null) as any;
  const failure = apiError(payload, "TikTok video lookup failed.");
  if (!response.ok || failure) throw new Error(failure ?? `TikTok video lookup failed (${response.status}).`);
  return payload?.data?.videos ?? [];
}

export async function saveTikTokProfilePosts(userId: string, videos: any[]) {
  if (!Array.isArray(videos) || videos.length > 3) throw new Error("Choose up to three TikTok videos.");
  const account = (await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM "StreamerAccount" WHERE "userId"=$1 AND platform='tiktok' AND verified=TRUE`, userId))[0];
  if (!account) throw new Error("Connect TikTok first.");
  const available = await listTikTokVideos(userId);
  const byId = new Map(available.map((video: any) => [String(video.id), video]));
  const selected = videos.map(value => byId.get(String(value))).filter(Boolean);
  if (selected.length !== videos.length) throw new Error("One or more selected TikTok videos are unavailable.");
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`DELETE FROM "StreamerProfilePost" WHERE "accountId"=$1`, account.id);
    for (let index = 0; index < selected.length; index++) {
      const video: any = selected[index];
      await tx.$executeRawUnsafe(`INSERT INTO "StreamerProfilePost" (id,"accountId","postUrl","embedUrl","thumbnailUrl",position,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), account.id, video.share_url, video.embed_link, video.cover_image_url ?? null, index + 1);
    }
    await tx.$executeRawUnsafe(`UPDATE "StreamerAccount" SET "showProfilePosts"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`, account.id, selected.length > 0);
  });
  return selected.length;
}
