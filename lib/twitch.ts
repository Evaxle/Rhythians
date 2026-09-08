import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { encryptStreamerToken } from "@/lib/stream-token-crypto";

const TWITCH_AUTHORIZE = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN = "https://id.twitch.tv/oauth2/token";
const TWITCH_API = "https://api.twitch.tv/helix";

function config() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const redirectUri = process.env.TWITCH_REDIRECT_URI ?? "https://rhythians.vercel.app/api/profile/streaming/twitch/callback";
  if (!clientId || !clientSecret) throw new Error("Twitch integration is not configured yet.");
  return { clientId, clientSecret, redirectUri };
}

export function createTwitchAuthorization() {
  const { clientId, redirectUri } = config();
  const state = randomBytes(32).toString("base64url");
  const url = new URL(TWITCH_AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "");
  url.searchParams.set("state", state);
  return { state, url: url.toString() };
}

type TwitchTokens = { access_token: string; expires_in: number; refresh_token: string; scope?: string[]; token_type: string };

export async function exchangeTwitchCode(code: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const response = await fetch(TWITCH_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }), cache: "no-store" });
  const data = await response.json().catch(() => null) as (TwitchTokens & { message?: string }) | null;
  if (!response.ok || !data?.access_token) throw new Error(data?.message ?? "Twitch token exchange failed.");
  return data;
}

export async function saveTwitchAccount(userId: string, tokens: TwitchTokens) {
  const { clientId } = config();
  const response = await fetch(`${TWITCH_API}/users`, { headers: { "Client-Id": clientId, Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { data?: Array<{ id: string; login: string }> } | null;
  const profile = payload?.data?.[0];
  if (!response.ok || !profile?.id || !profile.login) throw new Error("Twitch profile lookup failed.");
  const username = profile.login.toLowerCase();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "StreamerAccount" (id,"userId",platform,username,"profileUrl","providerAccountId","accessToken","refreshToken","tokenExpiresAt",scopes,verified,"verifiedAt","isLive","createdAt","updatedAt") VALUES ($1,$2,'twitch',$3,$4,$5,$6,$7,$8,$9,TRUE,CURRENT_TIMESTAMP,FALSE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("userId",platform) DO UPDATE SET username=EXCLUDED.username,"profileUrl"=EXCLUDED."profileUrl","providerAccountId"=EXCLUDED."providerAccountId","accessToken"=EXCLUDED."accessToken","refreshToken"=EXCLUDED."refreshToken","tokenExpiresAt"=EXCLUDED."tokenExpiresAt",scopes=EXCLUDED.scopes,verified=TRUE,"verifiedAt"=CURRENT_TIMESTAMP,"verificationCode"=NULL,"verificationExpiresAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP`,
    randomUUID(), userId, username, `https://www.twitch.tv/${username}`, profile.id, encryptStreamerToken(tokens.access_token), encryptStreamerToken(tokens.refresh_token), new Date(Date.now() + tokens.expires_in * 1000), (tokens.scope ?? []).join(" "),
  );
}

async function appAccessToken() {
  const { clientId, clientSecret } = config();
  const response = await fetch(TWITCH_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }), cache: "no-store" });
  const data = await response.json().catch(() => null) as { access_token?: string; message?: string } | null;
  if (!response.ok || !data?.access_token) throw new Error(data?.message ?? "Twitch app authorization failed.");
  return data.access_token;
}

export async function listTwitchClips(userId: string) {
  const account = (await prisma.$queryRawUnsafe<Array<{ providerAccountId: string | null; username: string }>>(`SELECT "providerAccountId",username FROM "StreamerAccount" WHERE "userId"=$1 AND platform='twitch' AND verified=TRUE LIMIT 1`, userId))[0];
  if (!account?.providerAccountId) throw new Error("Connect Twitch first.");
  const { clientId } = config();
  const token = await appAccessToken();
  const url = new URL(`${TWITCH_API}/clips`);
  url.searchParams.set("broadcaster_id", account.providerAccountId);
  url.searchParams.set("first", "20");
  const response = await fetch(url, { headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { data?: Array<Record<string, unknown>>; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Twitch clips could not be loaded.");
  return (payload?.data ?? []).map((clip: any) => ({
    id: String(clip.id),
    title: String(clip.title || "Twitch clip"),
    url: String(clip.url || `https://clips.twitch.tv/${clip.id}`),
    embedUrl: String(clip.embed_url || ""),
    thumbnailUrl: clip.thumbnail_url ? String(clip.thumbnail_url) : null,
    creatorName: clip.creator_name ? String(clip.creator_name) : null,
    createdAt: clip.created_at ? String(clip.created_at) : null,
    duration: typeof clip.duration === "number" ? clip.duration : null,
    viewCount: typeof clip.view_count === "number" ? clip.view_count : null,
  }));
}
