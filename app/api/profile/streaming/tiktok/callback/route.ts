import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { exchangeTikTokCode, saveTikTokAccount } from "@/lib/tiktok";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhythians.vercel.app";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/", site));
  const profile = new URL(`/profile/${user.profileHandle}`, site);
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("rhythians_tiktok_oauth_state")?.value;
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error_description")?.trim() || request.nextUrl.searchParams.get("error")?.trim();
  try {
    if (oauthError) throw new Error(oauthError);
    if (!state || !expectedState || state !== expectedState) throw new Error("TikTok authorization state did not match. Please try again.");
    if (!code) throw new Error("TikTok did not return an authorization code.");
    const tokens = await exchangeTikTokCode(code);
    await saveTikTokAccount(user.id, tokens);
    profile.searchParams.set("tiktok_connected", "1");
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "TikTok connection failed. Please try connecting again.";
    profile.searchParams.set("tiktok_error", message);
  }
  const response = NextResponse.redirect(profile);
  response.cookies.set("rhythians_tiktok_oauth_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
